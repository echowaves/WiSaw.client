import React, { lazy } from "react";
const Footer = lazy(() => import("./Footer"))

const Contact = () => {
return (
    <div className="container" style={{ padding: "20px", textAlign: "left" }}>
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
        <Footer />
    </div>
);
};

export default Contact;