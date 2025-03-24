import React, { lazy } from "react";
import { Helmet } from "react-helmet-async"

const Footer = lazy(() => import("./Footer"))

const About = () => {
  return (
    <>
    <div className="container" style={{ padding: "20px" }}>
        <Helmet prioritizeSeoTags>
        <title>Free Stock Photos & Videos -- What I Saw, about us</title>
        <link
            rel='canonical'
            href={`https://wisaw.com/about`}
          />
        </Helmet>

      <h1  style={{ textAlign: "left" }}>About WiSaw</h1>
      <p style={{ textAlign: "left" }}>
      Welcome to WiSaw – a platform where authenticity meets creativity. 
      WiSaw stands for &quot;What I Saw,&quot; and our mission is to celebrate unfiltered, 
      genuine moments captured through the lenses of everyday creators around the world. 
      Whether you&apos;re a professional photographer, an aspiring content creator, or just someone who loves sharing life&apos;s moments, 
      WiSaw is here to showcase your vision and inspire others.      
      </p>
      <h2 style={{ textAlign: "left" }}>Our Mission
      </h2>
        <p style={{ textAlign: "left" }}>
        We believe that every image has a story to tell, 
        and the best stories come from real, unaltered moments. 
        Our goal is to build a community-driven library of free, 
        authentic stock photos and videos that anyone can use to enhance their creative projects. 
        By offering royalty-free, high-quality content, we aim to empower individuals and businesses
        with the tools they need to communicate their ideas effectively.
        </p>
      <h2 style={{ textAlign: "left" }}>What Makes Us Different</h2>
      <p style={{ textAlign: "left" }}>
      </p>
      <ul style={{ textAlign: "left" }}>
        <li>
            <strong>Authenticity First:</strong> At WiSaw, we prioritize real, everyday visuals over staged or overly edited content. Each contribution reflects genuine human experiences.
        </li>
        <li>
            <strong>Community-Driven:</strong> Our platform thrives on the creativity and passion of our contributors. We&apos;re committed to building a supportive environment where creators can share their work with the world.
        </li>
        <li>
            <strong>Completely Free:</strong> All content on WiSaw is free to use for personal and commercial purposes, with clear licensing terms that ensure peace of mind.
        </li>
      </ul>
      <h2 style={{ textAlign: "left" }}>Join Our Community</h2>
      <p style={{ textAlign: "left" }}>Whether you&apos;re here to find the perfect photo or video for your project or to share your unique perspective, we welcome you to the WiSaw family. Together, we can redefine what stock media means by putting authenticity and creativity at the forefront.

Thank you for being a part of our journey. Let&apos;s create something amazing together.

</p>
<h2 style={{ textAlign: "left" }}>Contact Us</h2>
<p style={{ textAlign: "left" }}>Have questions, feedback, or just want to say hello? <a href="/contact">Reach out to us</a>. We&apos;d love to hear from you!</p>

    </div>
    <Footer />
    </>
  );
};

export default About;