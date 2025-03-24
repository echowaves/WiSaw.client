import React, { lazy } from "react";
import { Helmet } from "react-helmet-async"

const Footer = lazy(() => import("./Footer"))

const Contact = () => {
return (
    <>
    <div className="container" style={{ padding: "20px", textAlign: "left" }}>
                <Helmet prioritizeSeoTags>
                <title>Free Stock Photos & Videos -- What I Saw, contact us</title>
                <meta name="description" content="Get in touch with the WiSaw team. We'd love to hear your feedback, answer questions, or help with any concerns about our free stock photos and videos platform." />
                <link
                  rel='canonical'
                  href={`https://wisaw.com/contact`}
                />
                {/* Open Graph / Facebook */}
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://wisaw.com/contact" />
                <meta property="og:title" content="Contact WiSaw - Free Stock Photos & Videos Platform" />
                <meta property="og:description" content="Connect with the WiSaw team. Share your feedback, ask questions, or get support for our authentic, royalty-free stock media platform." />
                <meta property="og:image" content="https://wisaw.com/android-chrome-512x512.png" />
                
                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:url" content="https://wisaw.com/contact" />
                <meta name="twitter:title" content="Contact WiSaw - Free Stock Photos & Videos Platform" />
                <meta name="twitter:description" content="Connect with the WiSaw team. Share your feedback, ask questions, or get support for our authentic, royalty-free stock media platform." />
                <meta name="twitter:image" content="https://wisaw.com/android-chrome-512x512.png" />
                </Helmet>
        
        <h1>Contact Us</h1>
        <p style={{ textAlign: "left" }}>
            We&apos;d love to hear from you! If you have any questions, feedback, or concerns,
            please feel free to reach out to us using the information below.
        </p>
        <div style={{ marginTop: "20px" }}>        
            <p style={{ textAlign: "left" }}><a href="https://www.echowaves.com/support" target="_blank" rel="noopener noreferrer">submit a question</a></p>
            
            <h3>Social Media</h3>
            <p style={{ textAlign: "left" }}>Follow us on social media for updates and news.</p>
            <ul>
                    <li>
                            <a href="https://www.facebook.com/echowaves2/" target="_blank" rel="noopener noreferrer">Facebook</a>
                    </li>
                    <li>
                            <a href="https://x.com/echowaves" target="_blank" rel="noopener noreferrer">x.com</a>
                    </li>
                    <li>
                            <a href="https://www.linkedin.com/groups/13040336/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                    </li>   
            </ul>
            
            
            <h3>Support</h3>
            <p style={{ textAlign: "left" }}>For technical support, please <a href="https://www.echowaves.com/support" target="_blank" rel="noopener noreferrer">submit a request</a></p>
        </div>       
    </div>
    <Footer />
    </>
);
};

export default Contact;