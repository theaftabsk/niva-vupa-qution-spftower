import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import "../exam.css";
import { CheckCircle2, ShieldCheck, Home, Clock, Phone } from "lucide-react";

export default function CandidateThankYou() {
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: "linear-gradient(160deg, #E8F6FD 0%, #F4FAFF 50%, #FFF8EE 100%)",
    }}>
      <Navbar mode="public" />

      <main style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px 48px",
      }}>
        <div style={{
          width: "100%",
          maxWidth: "520px",
          background: "white",
          borderRadius: "28px",
          border: "1.5px solid #C8E8F8",
          boxShadow: "0 12px 40px rgba(0,63,114,0.13)",
          overflow: "hidden",
        }}>

          {/* Top accent bar */}
          <div style={{
            background: "linear-gradient(135deg, #003F72, #00AEEF)",
            height: "6px",
          }} />

          <div style={{ padding: "clamp(28px,7vw,48px) clamp(20px,6vw,40px)", textAlign: "center" }}>

            {/* Niva Bupa Logo */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "28px" }}>
              <Image
                src="/niva-bupa-logo.png"
                alt="Niva Bupa Health Insurance"
                width={210}
                height={191}
                style={{
                  height: "clamp(54px, 10vw, 75px)",
                  width: "auto",
                  borderRadius: "14px",
                  boxShadow: "0 6px 18px rgba(0, 160, 230, 0.22)",
                  objectFit: "contain"
                }}
              />
            </div>

            {/* Success Icon */}
            <div style={{
              width: "72px", height: "72px",
              background: "linear-gradient(135deg, #DCFCE7, #BBF7D0)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow: "0 6px 20px rgba(22,163,74,0.2)",
            }}>
              <CheckCircle2 size={36} color="#16A34A" />
            </div>

            <h1 style={{
              fontSize: "clamp(20px, 5vw, 26px)",
              fontWeight: 900, color: "#1A2B40",
              lineHeight: 1.25, marginBottom: "12px",
            }}>
              Assessment Submitted Successfully!
            </h1>

            <p style={{
              fontSize: "clamp(13px, 3vw, 15px)",
              color: "#4A6580", lineHeight: 1.7,
              maxWidth: "380px", margin: "0 auto 28px",
            }}>
              Thank you for completing the{" "}
              <strong style={{ color: "#003F72" }}>
                Assistant Relationship Manager – Banca Channel
              </strong>{" "}
              assessment.
            </p>

            {/* What Happens Next */}
            <div style={{
              background: "#F0F8FF",
              border: "1.5px solid #B3E0F9",
              borderRadius: "16px",
              padding: "18px 20px",
              textAlign: "left",
              marginBottom: "28px",
            }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div style={{
                  width: "36px", height: "36px", flexShrink: 0,
                  background: "#EBF7FF", borderRadius: "10px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ShieldCheck size={18} color="#00AEEF" />
                </div>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 800, color: "#003F72", marginBottom: "5px" }}>
                    What happens next?
                  </p>
                  <p style={{ fontSize: "12px", color: "#4A6580", lineHeight: 1.65 }}>
                    Your responses, competency scores, and sales simulation recording have been
                    securely recorded. The HR &amp; Recruitment evaluation team at CCE Programme will
                    review your application and reach out regarding next steps.
                  </p>
                </div>
              </div>
            </div>

            {/* Info pills */}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px", marginBottom: "28px" }}>
              {[
                { icon: Phone, text: "HR team will contact you directly", color: "#00AEEF", bg: "#EBF7FF" },
              ].map((item) => (
                <div key={item.text} style={{
                  display: "flex", alignItems: "center", gap: "7px",
                  background: item.bg, padding: "8px 14px",
                  borderRadius: "50px", fontSize: "11px",
                  fontWeight: 600, color: "#1A2B40",
                }}>
                  <item.icon size={13} color={item.color} />
                  {item.text}
                </div>
              ))}
            </div>

            {/* Home Button */}
            <Link href="/" style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "13px 28px", borderRadius: "12px",
              background: "linear-gradient(135deg, #003F72, #0070B8)",
              color: "white", fontWeight: 800, fontSize: "14px",
              textDecoration: "none",
              boxShadow: "0 6px 18px rgba(0,63,114,0.22)",
            }}>
              <Home size={16} />
              Return to Home
            </Link>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        background: "white", borderTop: "1.5px solid #C8E8F8",
        padding: "16px", textAlign: "center",
      }}>
        <p style={{ fontSize: "11px", color: "#8BA4BE", fontWeight: 500 }}>
          © 2026 CCE Programme Team • Recruitment Assessment
        </p>
      </footer>
    </div>
  );
}
