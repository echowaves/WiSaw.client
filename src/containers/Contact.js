import React from "react";

const Contact = () => {
  return (
    <div className="container" style={{ padding: "20px" }}>
      <h1>Contact Us</h1>
      <p>
        We'd love to hear from you! If you have any questions, feedback, or concerns,
        please feel free to reach out to us using the information below.
      </p>
      <div style={{ marginTop: "20px" }}>
        <h3>Email</h3>
        <p>info@wisaw.com</p>
        
        <h3>Social Media</h3>
        <p>Follow us on social media for updates and news.</p>
        
        <h3>Support</h3>
        <p>For technical support, please email support@wisaw.com</p>
      </div>
    </div>
  );
};

export default Contact;