import React from "react";

const Terms = () => {
  return (
    <div className="container" style={{ padding: "20px" }}>
      <h1>Terms and Policies</h1>
      
      <section style={{ marginTop: "20px" }}>
        <h2>Terms of Use</h2>
        <p>
          By accessing or using the WiSaw service, you agree to be bound by these Terms of Use.
          These terms may be updated from time to time without notice to you.
        </p>
      </section>
      
      <section style={{ marginTop: "20px" }}>
        <h2>Privacy Policy</h2>
        <p>
          We respect your privacy and are committed to protecting your personal data.
          Our Privacy Policy outlines how we collect, use, and safeguard your information.
        </p>
      </section>
      
      <section style={{ marginTop: "20px" }}>
        <h2>Content Policy</h2>
        <p>
          Users are responsible for the content they share on WiSaw. Content that violates
          our community guidelines or applicable laws may be removed without notice.
        </p>
      </section>
    </div>
  );
};

export default Terms;