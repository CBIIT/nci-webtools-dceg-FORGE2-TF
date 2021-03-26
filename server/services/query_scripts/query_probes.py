#!/usr/bin/env python3

import sqlite3
import os
import sys
import shutil
import json
import simplejson
from scipy.stats import hypergeom

try:
    probe_json_fn = sys.argv[1]
    total_number_of_probes = int(sys.argv[2])
    fdr_threshold = float(sys.argv[3])
    total_number_of_tests = int(sys.argv[4])
    data_dir = sys.argv[5]
except IndexError as ie:
    raise SystemError("specify arguments")

sys.stderr.write("%s\n" % (probe_json_fn))

with open(probe_json_fn, "r") as fh:
    probes = simplejson.load(fh)['probes']

dbs = {
    "xfac" :     "hg19.xfac.1e-4",
    "uniprobe" : "hg19.uniprobe.1e-4",
    "jaspar" :   "hg19.jaspar.1e-4",
    "taipale" :  "hg19.taipale.1e-4"
}

paddings = [0]

# wd = '/var/www/eforge/forge2-tf/browser/src/client/assets/services/data/All/tf'
wd = os.path.join(data_dir, 'All', 'tf')
lists_dir = os.path.join(wd, "lists")

# --------------------------------------------------------------------------
#
# cf. http://www.statsmodels.org/dev/_modules/statsmodels/stats/multitest.html
#
# Includes test number customizations, to count all TFs from all databases
#

# from statsmodels.compat.python import range
# from statsmodels.compat.collections import OrderedDict
from collections import OrderedDict
import numpy as np

def _ecdf(x):
    '''no frills empirical cdf used in fdrcorrection
    '''
    nobs = len(x)
    return np.arange(1,nobs+1)/float(nobs)

multitest_methods_names = {'b': 'Bonferroni',
                           's': 'Sidak',
                           'h': 'Holm',
                           'hs': 'Holm-Sidak',
                           'sh': 'Simes-Hochberg',
                           'ho': 'Hommel',
                           'fdr_bh': 'FDR Benjamini-Hochberg',
                           'fdr_by': 'FDR Benjamini-Yekutieli',
                           'fdr_tsbh': 'FDR 2-stage Benjamini-Hochberg',
                           'fdr_tsbky': 'FDR 2-stage Benjamini-Krieger-Yekutieli',
                           'fdr_gbs': 'FDR adaptive Gavrilov-Benjamini-Sarkar'
                           }

_alias_list = [['b', 'bonf', 'bonferroni'],
               ['s', 'sidak'],
               ['h', 'holm'],
               ['hs', 'holm-sidak'],
               ['sh', 'simes-hochberg'],
               ['ho', 'hommel'],
               ['fdr_bh', 'fdr_i', 'fdr_p', 'fdri', 'fdrp'],
               ['fdr_by', 'fdr_n', 'fdr_c', 'fdrn', 'fdrcorr'],
               ['fdr_tsbh', 'fdr_2sbh'],
               ['fdr_tsbky', 'fdr_2sbky', 'fdr_twostage'],
               ['fdr_gbs']
               ]


multitest_alias = OrderedDict()
for m in _alias_list:
    multitest_alias[m[0]] = m[0]
    for a in m[1:]:
        multitest_alias[a] = m[0]
  
def multipletests(pvals, alpha=0.05, method='hs', is_sorted=False, returnsorted=False, ntests=None):
    """
    Test results and p-value correction for multiple tests

    Parameters
    ----------
    pvals : array_like, 1-d
        uncorrected p-values.   Must be 1-dimensional.
    alpha : float
        FWER, family-wise error rate, e.g. 0.1
    method : string
        Method used for testing and adjustment of pvalues. Can be either the
        full name or initial letters. Available methods are:

        - `bonferroni` : one-step correction
        - `sidak` : one-step correction
        - `holm-sidak` : step down method using Sidak adjustments
        - `holm` : step-down method using Bonferroni adjustments
        - `simes-hochberg` : step-up method  (independent)
        - `hommel` : closed method based on Simes tests (non-negative)
        - `fdr_bh` : Benjamini/Hochberg  (non-negative)
        - `fdr_by` : Benjamini/Yekutieli (negative)
        - `fdr_tsbh` : two stage fdr correction (non-negative)
        - `fdr_tsbky` : two stage fdr correction (non-negative)

    is_sorted : bool
        If False (default), the p_values will be sorted, but the corrected
        pvalues are in the original order. If True, then it assumed that the
        pvalues are already sorted in ascending order.
    returnsorted : bool
         not tested, return sorted p-values instead of original sequence

    Returns
    -------
    reject : array, boolean
        true for hypothesis that can be rejected for given alpha
    pvals_corrected : array
        p-values corrected for multiple tests
    alphacSidak: float
        corrected alpha for Sidak method
    alphacBonf: float
        corrected alpha for Bonferroni method

    Notes
    -----
    There may be API changes for this function in the future.

    Except for 'fdr_twostage', the p-value correction is independent of the
    alpha specified as argument. In these cases the corrected p-values
    can also be compared with a different alpha. In the case of 'fdr_twostage',
    the corrected p-values are specific to the given alpha, see
    ``fdrcorrection_twostage``.

    The 'fdr_gbs' procedure is not verified against another package, p-values
    are derived from scratch and are not derived in the reference. In Monte
    Carlo experiments the method worked correctly and maintained the false
    discovery rate.

    All procedures that are included, control FWER or FDR in the independent
    case, and most are robust in the positively correlated case.

    `fdr_gbs`: high power, fdr control for independent case and only small
    violation in positively correlated case

    **Timing**:

    Most of the time with large arrays is spent in `argsort`. When
    we want to calculate the p-value for several methods, then it is more
    efficient to presort the pvalues, and put the results back into the
    original order outside of the function.

    Method='hommel' is very slow for large arrays, since it requires the
    evaluation of n partitions, where n is the number of p-values.
    """
    import gc
    pvals = np.asarray(pvals)
    alphaf = alpha  # Notation ?

    if not is_sorted:
        sortind = np.argsort(pvals)
        pvals = np.take(pvals, sortind)

    #ntests = len(pvals)
    alphacSidak = 1 - np.power((1. - alphaf), 1./ntests)
    alphacBonf = alphaf / float(ntests)
    if method.lower() in ['b', 'bonf', 'bonferroni']:
        reject = pvals <= alphacBonf
        pvals_corrected = pvals * float(ntests)

    elif method.lower() in ['s', 'sidak']:
        reject = pvals <= alphacSidak
        pvals_corrected = 1 - np.power((1. - pvals), ntests)

    elif method.lower() in ['hs', 'holm-sidak']:
        alphacSidak_all = 1 - np.power((1. - alphaf),
                                       1./np.arange(ntests, 0, -1))
        notreject = pvals > alphacSidak_all
        del alphacSidak_all

        nr_index = np.nonzero(notreject)[0]
        if nr_index.size == 0:
            # nonreject is empty, all rejected
            notrejectmin = len(pvals)
        else:
            notrejectmin = np.min(nr_index)
        notreject[notrejectmin:] = True
        reject = ~notreject
        del notreject

        pvals_corrected_raw = 1 - np.power((1. - pvals),
                                           np.arange(ntests, 0, -1))
        pvals_corrected = np.maximum.accumulate(pvals_corrected_raw)
        del pvals_corrected_raw

    elif method.lower() in ['h', 'holm']:
        notreject = pvals > alphaf / np.arange(ntests, 0, -1)
        nr_index = np.nonzero(notreject)[0]
        if nr_index.size == 0:
            # nonreject is empty, all rejected
            notrejectmin = len(pvals)
        else:
            notrejectmin = np.min(nr_index)
        notreject[notrejectmin:] = True
        reject = ~notreject
        pvals_corrected_raw = pvals * np.arange(ntests, 0, -1)
        pvals_corrected = np.maximum.accumulate(pvals_corrected_raw)
        del pvals_corrected_raw
        gc.collect()

    elif method.lower() in ['sh', 'simes-hochberg']:
        alphash = alphaf / np.arange(ntests, 0, -1)
        reject = pvals <= alphash
        rejind = np.nonzero(reject)
        if rejind[0].size > 0:
            rejectmax = np.max(np.nonzero(reject))
            reject[:rejectmax] = True
        pvals_corrected_raw = np.arange(ntests, 0, -1) * pvals
        pvals_corrected = np.minimum.accumulate(pvals_corrected_raw[::-1])[::-1]
        del pvals_corrected_raw

    elif method.lower() in ['ho', 'hommel']:
        # we need a copy because we overwrite it in a loop
        a = pvals.copy()
        for m in range(ntests, 1, -1):
            cim = np.min(m * pvals[-m:] / np.arange(1,m+1.))
            a[-m:] = np.maximum(a[-m:], cim)
            a[:-m] = np.maximum(a[:-m], np.minimum(m * pvals[:-m], cim))
        pvals_corrected = a
        reject = a <= alphaf

    elif method.lower() in ['fdr_bh', 'fdr_i', 'fdr_p', 'fdri', 'fdrp']:
        # delegate, call with sorted pvals
        reject, pvals_corrected = fdrcorrection(pvals, alpha=alpha,
                                                 method='indep',
                                                 is_sorted=True)
    elif method.lower() in ['fdr_by', 'fdr_n', 'fdr_c', 'fdrn', 'fdrcorr']:
        # delegate, call with sorted pvals
        reject, pvals_corrected = fdrcorrection(pvals, alpha=alpha, method='n', is_sorted=True)
    elif method.lower() in ['fdr_tsbky', 'fdr_2sbky', 'fdr_twostage']:
        # delegate, call with sorted pvals
        reject, pvals_corrected = fdrcorrection_twostage(pvals, alpha=alpha,
                                                         method='bky',
                                                         is_sorted=True)[:2]
    elif method.lower() in ['fdr_tsbh', 'fdr_2sbh']:
        # delegate, call with sorted pvals
        reject, pvals_corrected = fdrcorrection_twostage(pvals, alpha=alpha,
                                                         method='bh',
                                                         is_sorted=True)[:2]

    elif method.lower() in ['fdr_gbs']:
        #adaptive stepdown in Gavrilov, Benjamini, Sarkar, Annals of Statistics 2009
##        notreject = pvals > alphaf / np.arange(ntests, 0, -1) #alphacSidak
##        notrejectmin = np.min(np.nonzero(notreject))
##        notreject[notrejectmin:] = True
##        reject = ~notreject

        ii = np.arange(1, ntests + 1)
        q = (ntests + 1. - ii)/ii * pvals / (1. - pvals)
        pvals_corrected_raw = np.maximum.accumulate(q) #up requirementd

        pvals_corrected = np.minimum.accumulate(pvals_corrected_raw[::-1])[::-1]
        del pvals_corrected_raw
        reject = pvals_corrected <= alpha

    else:
        raise ValueError('method not recognized')

    if not pvals_corrected is None: #not necessary anymore
        pvals_corrected[pvals_corrected>1] = 1
    if is_sorted or returnsorted:
        return reject, pvals_corrected, alphacSidak, alphacBonf
    else:
        pvals_corrected_ = np.empty_like(pvals_corrected)
        pvals_corrected_[sortind] = pvals_corrected
        del pvals_corrected
        reject_ = np.empty_like(reject)
        reject_[sortind] = reject
        return reject_, pvals_corrected_, alphacSidak, alphacBonf

def fdrcorrection(pvals, alpha=0.05, method='indep', is_sorted=False):
    '''pvalue correction for false discovery rate

    This covers Benjamini/Hochberg for independent or positively correlated and
    Benjamini/Yekutieli for general or negatively correlated tests. Both are
    available in the function multipletests, as method=`fdr_bh`, resp. `fdr_by`.

    Parameters
    ----------
    pvals : array_like
        set of p-values of the individual tests.
    alpha : float
        error rate
    method : {'indep', 'negcorr')

    Returns
    -------
    rejected : array, bool
        True if a hypothesis is rejected, False if not
    pvalue-corrected : array
        pvalues adjusted for multiple hypothesis testing to limit FDR

    Notes
    -----

    If there is prior information on the fraction of true hypothesis, then alpha
    should be set to alpha * m/m_0 where m is the number of tests,
    given by the p-values, and m_0 is an estimate of the true hypothesis.
    (see Benjamini, Krieger and Yekuteli)

    The two-step method of Benjamini, Krieger and Yekutiel that estimates the number
    of false hypotheses will be available (soon).

    Method names can be abbreviated to first letter, 'i' or 'p' for fdr_bh and 'n' for
    fdr_by.



    '''
    pvals = np.asarray(pvals)

    if not is_sorted:
        pvals_sortind = np.argsort(pvals)
        pvals_sorted = np.take(pvals, pvals_sortind)
    else:
        pvals_sorted = pvals  # alias

    if method in ['i', 'indep', 'p', 'poscorr']:
        ecdffactor = _ecdf(pvals_sorted)
    elif method in ['n', 'negcorr']:
        cm = np.sum(1./np.arange(1, len(pvals_sorted)+1))   #corrected this
        ecdffactor = _ecdf(pvals_sorted) / cm
##    elif method in ['n', 'negcorr']:
##        cm = np.sum(np.arange(len(pvals)))
##        ecdffactor = ecdf(pvals_sorted)/cm
    else:
        raise ValueError('only indep and negcorr implemented')
    reject = pvals_sorted <= ecdffactor*alpha
    if reject.any():
        rejectmax = max(np.nonzero(reject)[0])
        reject[:rejectmax] = True

    pvals_corrected_raw = pvals_sorted / ecdffactor
    pvals_corrected = np.minimum.accumulate(pvals_corrected_raw[::-1])[::-1]
    del pvals_corrected_raw
    pvals_corrected[pvals_corrected>1] = 1
    if not is_sorted:
        pvals_corrected_ = np.empty_like(pvals_corrected)
        pvals_corrected_[pvals_sortind] = pvals_corrected
        del pvals_corrected
        reject_ = np.empty_like(reject)
        reject_[pvals_sortind] = reject
        return reject_, pvals_corrected_
    else:
        return reject, pvals_corrected

def fdrcorrection_twostage(pvals, alpha=0.05, method='bky', iter=False, is_sorted=False):
    '''(iterated) two stage linear step-up procedure with estimation of number of true
    hypotheses

    Benjamini, Krieger and Yekuteli, procedure in Definition 6

    Parameters
    ----------
    pvals : array_like
        set of p-values of the individual tests.
    alpha : float
        error rate
    method : {'bky', 'bh')
        see Notes for details

        * 'bky' - implements the procedure in Definition 6 of Benjamini, Krieger
           and Yekuteli 2006
        * 'bh' - the two stage method of Benjamini and Hochberg

    iter : bool

    Returns
    -------
    rejected : array, bool
        True if a hypothesis is rejected, False if not
    pvalue-corrected : array
        pvalues adjusted for multiple hypotheses testing to limit FDR
    m0 : int
        ntest - rej, estimated number of true hypotheses
    alpha_stages : list of floats
        A list of alphas that have been used at each stage

    Notes
    -----
    The returned corrected p-values are specific to the given alpha, they
    cannot be used for a different alpha.

    The returned corrected p-values are from the last stage of the fdr_bh
    linear step-up procedure (fdrcorrection0 with method='indep') corrected
    for the estimated fraction of true hypotheses.
    This means that the rejection decision can be obtained with
    ``pval_corrected <= alpha``, where ``alpha`` is the origianal significance
    level.
    (Note: This has changed from earlier versions (<0.5.0) of statsmodels.)

    BKY described several other multi-stage methods, which would be easy to implement.
    However, in their simulation the simple two-stage method (with iter=False) was the
    most robust to the presence of positive correlation

    TODO: What should be returned?

    '''
    pvals = np.asarray(pvals)

    if not is_sorted:
        pvals_sortind = np.argsort(pvals)
        pvals = np.take(pvals, pvals_sortind)

    ntests = len(pvals)
    if method == 'bky':
        fact = (1.+alpha)
        alpha_prime = alpha / fact
    elif method == 'bh':
        fact = 1.
        alpha_prime = alpha
    else:
        raise ValueError("only 'bky' and 'bh' are available as method")

    alpha_stages = [alpha_prime]
    rej, pvalscorr = fdrcorrection(pvals, alpha=alpha_prime, method='indep',
                                   is_sorted=True)
    r1 = rej.sum()
    if (r1 == 0) or (r1 == ntests):
        return rej, pvalscorr * fact, ntests - r1, alpha_stages
    ri_old = r1

    while True:
        ntests0 = 1.0 * ntests - ri_old
        alpha_star = alpha_prime * ntests / ntests0
        alpha_stages.append(alpha_star)
        #print ntests0, alpha_star
        rej, pvalscorr = fdrcorrection(pvals, alpha=alpha_star, method='indep', is_sorted=True)
        ri = rej.sum()
        if (not iter) or ri == ri_old:
            break
        elif ri < ri_old:
            # prevent cycles and endless loops
            raise RuntimeError(" oops - shouldn't be here")
        ri_old = ri

    # make adjustment to pvalscorr to reflect estimated number of Non-Null cases
    # decision is then pvalscorr < alpha  (or <=)
    pvalscorr *= ntests0 * 1.0 /  ntests
    if method == 'bky':
        pvalscorr *= (1. + alpha)

    if not is_sorted:
        pvalscorr_ = np.empty_like(pvalscorr)
        pvalscorr_[pvals_sortind] = pvalscorr
        del pvalscorr
        reject = np.empty_like(rej)
        reject[pvals_sortind] = rej
        return reject, pvalscorr_, ntests - ri, alpha_stages
    else:
        return rej, pvalscorr, ntests - ri, alpha_stages



def local_fdr(zscores, null_proportion=1.0, null_pdf=None, deg=7, nbins=30):
    """
    Calculate local FDR values for a list of Z-scores.

    Parameters
    ----------
    zscores : array-like
        A vector of Z-scores
    null_proportion : float
        The assumed proportion of true null hypotheses
    null_pdf : function mapping reals to positive reals
        The density of null Z-scores; if None, use standard normal
    deg : integer
        The maximum exponent in the polynomial expansion of the
        density of non-null Z-scores
    nbins : integer
        The number of bins for estimating the marginal density
        of Z-scores.

    Returns
    -------
    fdr : array-like
        A vector of FDR values

    References
    ----------
    B Efron (2008).  Microarrays, Empirical Bayes, and the Two-Groups
    Model.  Statistical Science 23:1, 1-22.

    Examples
    --------
    Basic use (the null Z-scores are taken to be standard normal):

    >>> from statsmodels.stats.multitest import local_fdr
    >>> import numpy as np
    >>> zscores = np.random.randn(30)
    >>> fdr = local_fdr(zscores)

    Use a Gaussian null distribution estimated from the data:

    >>> null = EmpiricalNull(zscores)
    >>> fdr = local_fdr(zscores, null_pdf=null.pdf)
    """

    from statsmodels.genmod.generalized_linear_model import GLM
    from statsmodels.genmod.generalized_linear_model import families
    from statsmodels.regression.linear_model import OLS

    # Bins for Poisson modeling of the marginal Z-score density
    minz = min(zscores)
    maxz = max(zscores)
    bins = np.linspace(minz, maxz, nbins)

    # Bin counts
    zhist = np.histogram(zscores, bins)[0]

    # Bin centers
    zbins = (bins[:-1] + bins[1:]) / 2

    # The design matrix at bin centers
    dmat = np.vander(zbins, deg + 1)

    # Use this to get starting values for Poisson regression
    md = OLS(np.log(1 + zhist), dmat).fit()

    # Poisson regression
    md = GLM(zhist, dmat, family=families.Poisson()).fit(start_params=md.params)

    # The design matrix for all Z-scores
    dmat_full = np.vander(zscores, deg + 1)

    # The height of the estimated marginal density of Z-scores,
    # evaluated at every observed Z-score.
    fz = md.predict(dmat_full) / (len(zscores) * (bins[1] - bins[0]))

    # The null density.
    if null_pdf is None:
        f0 = np.exp(-0.5 * zscores**2) / np.sqrt(2 * np.pi)
    else:
        f0 = null_pdf(zscores)

    # The local FDR values
    fdr = null_proportion * f0 / fz

    fdr = np.clip(fdr, 0, 1)

    return fdr

class NullDistribution(object):
    """
    Estimate a Gaussian distribution for the null Z-scores.

    The observed Z-scores consist of both null and non-null values.
    The fitted distribution of null Z-scores is Gaussian, but may have
    non-zero mean and/or non-unit scale.

    Parameters
    ----------
    zscores : array-like
        The observed Z-scores.
    null_lb : float
        Z-scores between `null_lb` and `null_ub` are all considered to be
        true null hypotheses.
    null_ub : float
        See `null_lb`.
    estimate_mean : bool
        If True, estimate the mean of the distribution.  If False, the
        mean is fixed at zero.
    estimate_scale : bool
        If True, estimate the scale of the distribution.  If False, the
        scale parameter is fixed at 1.
    estimate_null_proportion : bool
        If True, estimate the proportion of true null hypotheses (i.e.
        the proportion of z-scores with expected value zero).  If False,
        this parameter is fixed at 1.

    Attributes
    ----------
    mean : float
        The estimated mean of the empirical null distribution
    sd : float
        The estimated standard deviation of the empirical null distribution
    null_proportion : float
        The estimated proportion of true null hypotheses among all hypotheses

    References
    ----------
    B Efron (2008).  Microarrays, Empirical Bayes, and the Two-Groups
    Model.  Statistical Science 23:1, 1-22.

    Notes
    -----
    See also:

    http://nipy.org/nipy/labs/enn.html#nipy.algorithms.statistics.empirical_pvalue.NormalEmpiricalNull.fdr
    """

    def __init__(self, zscores, null_lb=-1, null_ub=1, estimate_mean=True, estimate_scale=True, estimate_null_proportion=False):

        # Extract the null z-scores
        ii = np.flatnonzero((zscores >= null_lb) & (zscores <= null_ub))
        if len(ii) == 0:
            raise RuntimeError("No Z-scores fall between null_lb and null_ub")
        zscores0 = zscores[ii]

        # Number of Z-scores, and null Z-scores
        n_zs, n_zs0 = len(zscores), len(zscores0)

        # Unpack and transform the parameters to the natural scale, hold
        # parameters fixed as specified.
        def xform(params):

            mean = 0.
            sd = 1.
            prob = 1.

            ii = 0
            if estimate_mean:
                mean = params[ii]
                ii += 1
            if estimate_scale:
                sd = np.exp(params[ii])
                ii += 1
            if estimate_null_proportion:
                prob = 1 / (1 + np.exp(-params[ii]))

            return mean, sd, prob


        from scipy.stats.distributions import norm


        def fun(params):
            """
            Negative log-likelihood of z-scores.

            The function has three arguments, packed into a vector:

            mean : location parameter
            logscale : log of the scale parameter
            logitprop : logit of the proportion of true nulls

            The implementation follows section 4 from Efron 2008.
            """

            d, s, p = xform(params)

            # Mass within the central region
            central_mass = (norm.cdf((null_ub - d) / s) -
                            norm.cdf((null_lb - d) / s))

            # Probability that a Z-score is null and is in the central region
            cp = p * central_mass

            # Binomial term
            rval = n_zs0 * np.log(cp) + (n_zs - n_zs0) * np.log(1 - cp)

            # Truncated Gaussian term for null Z-scores
            zv = (zscores0 - d) / s
            rval += np.sum(-zv**2 / 2) - n_zs0 * np.log(s)
            rval -= n_zs0 * np.log(central_mass)

            return -rval


        # Estimate the parameters
        from scipy.optimize import minimize
        # starting values are mean = 0, scale = 1, p0 ~ 1
        mz = minimize(fun, np.r_[0., 0, 3], method="Nelder-Mead")
        mean, sd, prob = xform(mz['x'])

        self.mean = mean
        self.sd = sd
        self.null_proportion = prob


    # The fitted null density function
    def pdf(self, zscores):
        """
        Evaluates the fitted emirical null Z-score density.

        Parameters
        ----------
        zscores : scalar or array-like
            The point or points at which the density is to be
            evaluated.

        Returns
        -------
        The empirical null Z-score density evaluated at the given
        points.
        """

        zval = (zscores - self.mean) / self.sd
        return np.exp(-0.5*zval**2 - np.log(self.sd) - 0.5*np.log(2*np.pi))
        
# --------------------------------------------------------------------------

def query_tables(dbs):
    #sys.stderr.write("B1\n")
    result = {}
    for k in dbs.keys():
        # read in list
        ordered_tfs = []
        mapped_tfs = {}
        with open(os.path.join(lists_dir, "%s.txt" % (k)), "r") as lfh:
            idx = 0
            for line in lfh:
                ordered_tfs.append(line.rstrip())
                mapped_tfs[line.rstrip()] = idx
                idx += 1
            if not k in result:
                result[k] = {}
            result[k]['ordered_tfs'] = ordered_tfs
            result[k]['mapped_tfs'] = mapped_tfs
        for p in paddings:
            sqlite_fn = os.path.join(wd, "%s_ids" % (k), "probe.db.%d.starch.reduced.mtx.sqlite" % (p))
            if not os.path.exists(sqlite_fn):
                raise SystemError("cannot find db [%s]\n" % (sqlite_fn))
            table_name = "%s" % (k)
            conn = sqlite3.connect(sqlite_fn)
            c = conn.cursor()
            query = "SELECT * FROM %s WHERE probe IN (%s)" % (table_name, ','.join('?' * len(probes)))
            c.execute(query, probes)
            result[k][str(p)] = c.fetchall()
            conn.close()
            with open(os.path.join(wd, "%s_ids" % (k), "probe.db.%d.starch.collapsed.mtx" % (p)), "r") as cfh:
                elems = cfh.read().rstrip().split('\t')
                result[k]['totals'] = elems[1:]
    #sys.stderr.write("B2\n")
    #sys.stderr.write('%s\n' % (result['taipale']['0']))
    #test = result['taipale']['0']
    #for (probe, bitstring) in test:
    #    bits = [x for x in bitstring]
    #    print(probe, bits[result['taipale']['mapped_tfs']['SPIC_ETS_1']])
    #sys.exit(-1)
    return result

def summary_to_hypergeometric_pvals(summary):
    #sys.stderr.write("C1\n")
    hypergeometric_pvals = {}
    for dbk in dbs.keys():
        #if dbk != 'jaspar': 
        #    continue
        for p in paddings:
            # reduce padding-specific tuples in summary[k][p] to find TF indices where there are overlaps
            tf_overlaps = {}
            ordered_tfs = summary[dbk]['ordered_tfs']
            mapped_tfs = summary[dbk]['mapped_tfs']
            totals = summary[dbk]['totals']
            tups = summary[dbk][str(p)]
            for tup in tups:
                (probe, bitstring) = tup
                bits = list(bitstring)
                for idx, bit in enumerate(bits):
                    if bit == '1':
                        if ordered_tfs[idx] not in tf_overlaps:
                            tf_overlaps[ordered_tfs[idx]] = 0
                        tf_overlaps[ordered_tfs[idx]] += 1
            #print(tf_overlaps)

            # use these indices to count TF-overlap totals over set of probes, and then over all probes via summary[k]['totals']
            all_overlaps = {}
            for tfk in tf_overlaps.keys():
                idx = mapped_tfs[tfk]
                all_overlaps[tfk] = totals[idx]
            #print(all_overlaps)

            # for each TF, calculate a hypergeometric p-value
            for tfk in tf_overlaps.keys():
                # number of probes ("balls") in probe-subset ("sample") that overlap TF (sample of "red balls")
                x = int(tf_overlaps[tfk])
                # number of probes ("balls") in set ("urn") ("all balls, black and red")
                M = int(total_number_of_probes)
                # number of probes in set ("urn") that overlap TF (all "red balls")
                n = int(all_overlaps[tfk])
                # number of probes in probe-subset ("sample")
                N = int(len(probes))
                #print('\t'.join([tfk, str(x), str(M), str(n), str(N)]))
                pval = 1.0 - hypergeom.cdf(x, M, n, N)
                if pval == 0.0:
                    pval = 2.2250738585072014e-308
                ip = str(p)
                if dbk not in hypergeometric_pvals:
                    hypergeometric_pvals[dbk] = {}
                    if ip not in hypergeometric_pvals[dbk]:
                        hypergeometric_pvals[dbk][ip] = []
                hypergeometric_pvals[dbk][ip].append({'id':tfk, 'score':pval})

    #sys.stderr.write("C2\n")
    return hypergeometric_pvals

def hypergeometric_pvals_to_corrected_pvals(summary=None, hp=None, fdrPct=0.05):
    corrected_hp = {}
    ids = []
    pvals = []
    id_to_db = {}
    for dbk in dbs.keys():
        for p in paddings:
            ip = str(p)
            try:
                for pairing in hp[dbk][ip]:
                    ids.append(pairing['id'])
                    pvals.append(float(pairing['score']))
                    id_to_db[pairing['id']] = dbk
            except KeyError as ke:
                pass
    (reject, pvals_corrected, alphacSidak, alphacBonf) = multipletests(pvals, alpha=fdrPct, method='fdr_by', is_sorted=False, returnsorted=False, ntests=total_number_of_tests)
    reject = reject.tolist()
    pvals_corrected = pvals_corrected.tolist()
    for id_idx, id_name in enumerate(ids):
        db_name = id_to_db[id_name]
        if db_name not in corrected_hp:
            corrected_hp[db_name] = []
        corrected_hp[db_name].append({
            'id' : id_name,
            'pval' : pvals[id_idx],
            'qval' : pvals_corrected[id_idx],
            'reject' : reject[id_idx],
            'alphacSidak' : alphacSidak,
            'alphacBonf' : alphacBonf
        })
    return corrected_hp

def main():    
    summary = query_tables(dbs)
    #sys.stdout.write('%s\n' % (summary))
    #sys.exit(-1)
    hp = summary_to_hypergeometric_pvals(summary)
    #sys.stdout.write('%s\n' % (hp))
    #sys.exit(-1)
    corrected_hp = hypergeometric_pvals_to_corrected_pvals(summary, hp, fdrPct=0.001)
    sys.stdout.write(json.dumps(corrected_hp))

if __name__ == "__main__":
    main()
