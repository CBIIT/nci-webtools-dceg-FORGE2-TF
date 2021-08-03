import React from 'react';
import {
    Row,
    Col
} from 'react-bootstrap';
import Brand from '../forge2-tf/panels/brand';


export function Home() {
  return (
    <div className="px-4">
        <div className="bg-white p-4" style={{
            boxShadow: "0px 1px 4px #3c3c3c",
            minHeight: "500px"
        }}>
            <Row>
                <Col lg={12} className="mb-3 text-center">
                    <img   
                        className="center-block"
                        src="assets/img/Transcription_Factors.svg"
                        alt="FORGE2-TF diagram"
                        width="75%"
                    />
                    <p className="figure-caption">
                        Modified from image by Kelvin13 (Own work, CC BY 3.0, <a style={{color: "#6c757d"}} href="https://commons.wikimedia.org/w/index.php?curid=23272278" target="_blank">https://commons.wikimedia.org/w/index.php?curid=23272278</a>)
                    </p>
                </Col>

                <Col lg={12}>
                    <div className="mb-2">
                        <Brand
                            brandTitle={'FORGE2-TF'}
                            brandSubtitle={'TF-centric SNP array browser'}
                        />
                    </div>
                </Col>
                <Col lg={12}>
                    <p>
                        The <em>FORGE2-TF</em> is a complementary method to the{` `}
                        <a href="https://forge2.altiusinstitute.org/"
                            target="_blank"
                            style={{ color: '#0062cc' }}>
                            FORGE2
                        </a>{` `}
                        GWAS analysis tool. FORGE2-TF enables the analysis of DNase-seq TF 
                        footprints surrounding GWAS SNPs and multidimensional analysis of predicted 
                        transcription factor binding sites from different TF databases.
                    </p>
                </Col>
            </Row>
        </div>
    </div>
  );
}
