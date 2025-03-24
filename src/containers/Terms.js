import React, { lazy } from "react";

import { Helmet } from "react-helmet-async"

const Footer = lazy(() => import("./Footer"))

const Terms = () => {
  return (
    <>
    <div className="container" style={{ padding: "20px" }}>
        <Helmet prioritizeSeoTags>
        <title>Free Stock Photos & Videos -- What I Saw, out terms and conditions</title>

                        <link
                          rel='canonical'
                          href={`https://wisaw.com/terms`}
                        />
                      </Helmet>

      <h1 style={{ textAlign: "left" }}>Terms and Conditions</h1>
      <p style={{ textAlign: "left" }}>

Last Updated: 03-23-2025
</p>
<p style={{ textAlign: "left" }}>Welcome to WiSaw! By accessing and using our website (wisaw.com), you agree to comply with the following Terms and Conditions. Please read them carefully before using our services.</p>

<h2 style={{ textAlign: "left" }}>1. Acceptance of Terms</h2>

<p style={{ textAlign: "left" }}>By accessing or using WiSaw, you agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree with any part of these terms, please do not use our platform.</p>

<h2 style={{ textAlign: "left" }}>2. Use of Content</h2>

<ul style={{ textAlign: "left" }}>
<li>All images and videos on WiSaw are free to use for personal and commercial purposes unless otherwise stated.</li>

<li>Attribution is not required but is appreciated when possible.</li>

<li>You may not sell, redistribute, or claim ownership of any content found on WiSaw.</li>

<li>Content must not be used in any manner that is illegal, misleading, defamatory, or offensive.</li>
</ul>

<h2 style={{ textAlign: "left" }}>3. User-Generated Content</h2>
<p style={{ textAlign: "left" }}>
By uploading content to WiSaw, you grant us a non-exclusive, royalty-free, worldwide license to distribute, modify, and display your content.

You must have the necessary rights to upload any content and ensure it does not infringe on any third-party rights.

We reserve the right to remove any content that violates our policies or is deemed inappropriate.
</p>

<h2 style={{ textAlign: "left" }}>
4. Limitation of Liability
</h2>
<p style={{ textAlign: "left" }}>
WiSaw provides content &quot;as is&quot; without warranties of any kind.

We do not guarantee the accuracy, completeness, or reliability of any content available on our platform.

WiSaw is not liable for any damages arising from the use of our website or content.

</p>

<h2 style={{ textAlign: "left" }}>
5. Third-Party Links
</h2>
<p style={{ textAlign: "left" }}>
WiSaw may contain links to third-party websites. We are not responsible for the content, policies, or practices of any third-party sites.
</p>

<h2 style={{ textAlign: "left" }}>
6. Changes to Terms
</h2>
<p style={{ textAlign: "left" }}>
We may update these Terms and Conditions at any time. Your continued use of WiSaw after changes are made constitutes your acceptance of the new terms.
</p>

<h2 style={{ textAlign: "left" }}>
7. Contact Us
</h2>

<p style={{ textAlign: "left" }}>
If you have any questions or concerns about these Terms and Conditions, please <a href="https://www.echowaves.com/support" target="_blank" rel="noopener noreferrer">submit a request</a>.
</p>


    </div>
    <Footer />
    </>
  );
};

export default Terms;