import React from 'react';
import {
    Row,
    Col
} from 'react-bootstrap';
import Brand from '../eforge-tf/panels/brand';


export function Home() {
  return (
    <div className="px-4 pb-4">
        <div className="bg-white p-4" style={{
            boxShadow: "0px 1px 4px #3c3c3c",
            minHeight: "500px"
        }}>
            <Row>
                <Col lg={6}>
                    <figure className="figure">
                        {/* <HomeImage className="figure-img img-fluid" /> */}
                        <img
                            src="assets/img/Transcription_Factors.svg"
                            alt="eFORGE TF diagram"
                        />
                        <figcaption className="figure-caption">
                            Modified from image by Kelvin13 (Own work, CC BY 3.0, <a style={{color: "#6c757d"}} href="https://commons.wikimedia.org/w/index.php?curid=23272278" target="_blank">https://commons.wikimedia.org/w/index.php?curid=23272278</a>)
                        </figcaption>
                    </figure>
                </Col>

                <Col lg={6}>
                    {/* <h1 className="h3">About</h1> */}
                    <div className="mb-2">
                        <Brand
                            brandTitle={'FORGE2 TF'}
                            brandSubtitle={'TF-centric SNP array browser'}
                        />
                    </div>
                    
                    <p>
                        The <em>FORGE2 TF</em> application is an adjunct to the{' '}
                        <a
                        href="https://forge2.altiusinstitute.org/"
                        target="_blank"
                        style={{ color: '#0062cc' }}
                        >
                        FORGE2
                        </a>{' '}
                        GWAS analysis tool. This enables the exploration of DNase I tag
                        (chromatin accessibility) signal surrounding GWAS array SNPs and
                        the calculation of significance of overlap with transcription
                        factor binding sites from common TF databases.
                    </p>
                </Col>
            </Row>
        </div>
    </div>
  );
}
