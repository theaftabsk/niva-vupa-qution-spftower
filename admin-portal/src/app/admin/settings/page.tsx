"use client";

import { useState, useEffect } from "react";
import {
  Settings as SettingsIcon, Save, CheckCircle2, ShieldCheck,
  User, Lock, KeyRound, AlertCircle, Mail, Send, Server, Zap
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

export default function AdminSettingsPage() {
  // Credentials State
  const [username, setUsername] = useState("admin");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credSuccessMsg, setCredSuccessMsg] = useState("");
  const [credErrorMsg, setCredErrorMsg] = useState("");

  // SMTP Settings State
  const [smtp, setSmtp] = useState({
    host: "smtp.gmail.com",
    port: 587,
    username: "",
    password: "",
    encryption: "TLS",
    fromName: "CCE Programme Team",
    fromEmail: "recruitment@greatcampus.in",
  });
  const [loadingSmtp, setLoadingSmtp] = useState(true);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testEmailTarget, setTestEmailTarget] = useState("");
  const [smtpSuccessMsg, setSmtpSuccessMsg] = useState("");
  const [smtpErrorMsg, setSmtpErrorMsg] = useState("");

  const loadSmtp = async () => {
    setLoadingSmtp(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/emails/smtp-config`);
      const data = await res.json();
      if (data.success && data.config) {
        setSmtp({
          host: data.config.host || "smtp.gmail.com",
          port: data.config.port || 587,
          username: data.config.username || "",
          password: "",
          encryption: data.config.encryption || "TLS",
          fromName: data.config.fromName || "CCE Programme Team",
          fromEmail: data.config.fromEmail || "recruitment@greatcampus.in",
        });
      }
    } catch {
      /* silent */
    } finally {
      setLoadingSmtp(false);
    }
  };

  useEffect(() => {
    loadSmtp();
  }, []);

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredErrorMsg("");
    setCredSuccessMsg("");

    if (!username.trim()) {
      setCredErrorMsg("Username cannot be empty.");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setCredErrorMsg("New Password and Confirm Password do not match.");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setCredErrorMsg("New password must be at least 6 characters long.");
      return;
    }

    setSavingCredentials(true);

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/auth/update-credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          currentPassword,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update admin credentials.");
      }

      setCredSuccessMsg("Admin credentials updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setCredSuccessMsg(""), 5000);
    } catch (err: any) {
      setCredErrorMsg(err.message || "An error occurred while saving settings.");
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpErrorMsg("");
    setSmtpSuccessMsg("");
    setSavingSmtp(true);

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/emails/smtp-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smtp),
      });
      const data = await res.json();
      if (data.success) {
        setSmtpSuccessMsg("SMTP mail server settings saved successfully!");
        setTimeout(() => setSmtpSuccessMsg(""), 5000);
      } else {
        throw new Error(data.message || "Failed to save SMTP settings.");
      }
    } catch (err: any) {
      setSmtpErrorMsg(err.message || "Error saving SMTP configuration.");
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleTestSmtp = async () => {
    setSmtpErrorMsg("");
    setSmtpSuccessMsg("");
    setTestingSmtp(true);

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/emails/test-smtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetEmail: testEmailTarget.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setSmtpSuccessMsg(data.message || "SMTP connection test succeeded! Test email delivered.");
      } else {
        throw new Error(data.message || "SMTP connection test failed.");
      }
    } catch (err: any) {
      setSmtpErrorMsg(err.message || "Failed to connect to SMTP server. Verify host, port, username & app password.");
    } finally {
      setTestingSmtp(false);
    }
  };

  return (
    <div className="set-page">
      {/* Header Bar */}
      <div className="set-header">
        <div>
          <h1 className="set-title">System Settings & SMTP Configuration</h1>
          <p className="set-subtitle">Manage HR Administrator access, authenticated SMTP mailer, and system modes</p>
        </div>
      </div>

      {/* CRM Standalone Banner */}
      <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "14px", padding: "16px 20px", marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#003F72", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Server size={18} />
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#003F72" }}>Assessment Platform: Standalone Enterprise Mode</div>
            <div style={{ fontSize: "12px", color: "#475569" }}>Outbound CRM webhooks are disabled. All candidates, attempts, and reports are safely stored locally in PostgreSQL.</div>
          </div>
        </div>
        <span style={{ padding: "5px 12px", borderRadius: "8px", background: "#DBEAFE", color: "#1E40AF", fontSize: "11px", fontWeight: 800 }}>
          CRM INTEGRATION: OFF (STANDALONE)
        </span>
      </div>

      {/* SMTP Email Server Configuration Card */}
      <div className="set-card" style={{ marginBottom: "24px" }}>
        <div className="set-card-header">
          <Mail size={18} className="set-card-icon" />
          <div>
            <h2 className="set-card-title">Authenticated SMTP Mailer Server</h2>
            <p className="set-card-sub">Configure outgoing email delivery for automated candidate invitations</p>
          </div>
        </div>

        {smtpSuccessMsg && (
          <div className="set-alert set-alert--success">
            <CheckCircle2 size={16} />
            <span>{smtpSuccessMsg}</span>
          </div>
        )}

        {smtpErrorMsg && (
          <div className="set-alert set-alert--error">
            <AlertCircle size={16} />
            <span>{smtpErrorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveSmtp} className="set-form">
          <div className="set-form-row">
            <div className="set-form-group">
              <label className="set-label">SMTP Server Host *</label>
              <input
                type="text"
                required
                placeholder="e.g. smtp.gmail.com or mail.greatcampus.in"
                value={smtp.host}
                onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                className="set-input"
              />
            </div>

            <div className="set-form-group">
              <label className="set-label">SMTP Port *</label>
              <input
                type="number"
                required
                placeholder="587 or 465"
                value={smtp.port}
                onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
                className="set-input"
              />
            </div>
          </div>

          <div className="set-form-row">
            <div className="set-form-group">
              <label className="set-label">SMTP Username / Email *</label>
              <input
                type="text"
                required
                placeholder="e.g. user@gmail.com"
                value={smtp.username}
                onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                className="set-input"
              />
            </div>

            <div className="set-form-group">
              <label className="set-label">SMTP Password / App Password</label>
              <input
                type="password"
                placeholder="Enter App Password (leave blank to keep current)"
                value={smtp.password}
                onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                className="set-input"
              />
            </div>
          </div>

          <div className="set-form-row">
            <div className="set-form-group">
              <label className="set-label">Sender Name (From Name)</label>
              <input
                type="text"
                placeholder="CCE Programme Team"
                value={smtp.fromName}
                onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })}
                className="set-input"
              />
            </div>

            <div className="set-form-group">
              <label className="set-label">Sender Email (From Email)</label>
              <input
                type="email"
                placeholder="recruitment@greatcampus.in"
                value={smtp.fromEmail}
                onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
                className="set-input"
              />
            </div>
          </div>

          <div className="set-form-group">
            <label className="set-label">Encryption Type</label>
            <select
              value={smtp.encryption}
              onChange={(e) => setSmtp({ ...smtp, encryption: e.target.value })}
              className="set-input font-bold"
            >
              <option value="TLS">TLS (Port 587 - Recommended)</option>
              <option value="SSL">SSL (Port 465)</option>
              <option value="NONE">None</option>
            </select>
          </div>

          {/* Test SMTP Email Input */}
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px", margin: "14px 0", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="email"
              placeholder="Enter test recipient email (optional)"
              value={testEmailTarget}
              onChange={(e) => setTestEmailTarget(e.target.value)}
              style={{ flex: 1, minWidth: "220px", padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            />
            <button
              type="button"
              disabled={testingSmtp}
              onClick={handleTestSmtp}
              style={{ padding: "8px 18px", borderRadius: "8px", background: "#003F72", color: "white", border: "none", fontWeight: 800, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Zap size={13} /> {testingSmtp ? "Testing Connection..." : "Test SMTP Connection"}
            </button>
          </div>

          <div className="set-form-footer">
            <button type="submit" disabled={savingSmtp} className="set-save-btn">
              <Save size={16} />
              {savingSmtp ? "Saving SMTP Configuration…" : "Save SMTP Settings"}
            </button>
          </div>
        </form>
      </div>

      {/* Credentials Card */}
      <div className="set-card">
        <div className="set-card-header">
          <KeyRound size={18} className="set-card-icon" />
          <div>
            <h2 className="set-card-title">Security & Administrator Login</h2>
            <p className="set-card-sub">Update HR Admin username and password</p>
          </div>
        </div>

        {credSuccessMsg && (
          <div className="set-alert set-alert--success">
            <CheckCircle2 size={16} />
            <span>{credSuccessMsg}</span>
          </div>
        )}

        {credErrorMsg && (
          <div className="set-alert set-alert--error">
            <AlertCircle size={16} />
            <span>{credErrorMsg}</span>
          </div>
        )}

        <form onSubmit={handleUpdateCredentials} className="set-form">
          <div className="set-form-group">
            <label className="set-label">
              <User size={14} /> Admin Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="set-input"
              placeholder="e.g. admin"
            />
          </div>

          <div className="set-form-group">
            <label className="set-label">
              <Lock size={14} /> Current Password (optional for first change)
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="set-input"
              placeholder="Enter current password"
            />
          </div>

          <div className="set-form-row">
            <div className="set-form-group">
              <label className="set-label">
                <Lock size={14} /> New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="set-input"
                placeholder="Enter new password (min 6 chars)"
              />
            </div>

            <div className="set-form-group">
              <label className="set-label">
                <Lock size={14} /> Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="set-input"
                placeholder="Re-enter new password"
              />
            </div>
          </div>

          <div className="set-form-footer">
            <button type="submit" disabled={savingCredentials} className="set-save-btn">
              <Save size={16} />
              {savingCredentials ? "Updating Credentials…" : "Save Password & Username"}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .set-page { padding: 28px 36px; width: 100%; max-width: 860px; margin: 0; background-color: #f8fafc; min-height: calc(100vh - 64px); box-sizing: border-box; }
        .set-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .set-title { font-size: 1.4rem; font-weight: 800; color: #0f172a; margin: 0; }
        .set-subtitle { font-size: 0.84rem; color: #64748b; margin-top: 2px; font-weight: 500; }

        .set-alert { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 12px; font-size: 0.86rem; margin-bottom: 20px; font-weight: 700; }
        .set-alert--success { background: #dcfce7; border: 1px solid #86efac; color: #166534; }
        .set-alert--error { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; }

        .set-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .set-card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
        .set-card-icon { color: #00AEEF; }
        .set-card-title { font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; }
        .set-card-sub { font-size: 0.78rem; color: #64748b; margin: 2px 0 0; }

        .set-form { display: flex; flex-direction: column; gap: 16px; }
        .set-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 640px) { .set-form-row { grid-template-columns: 1fr; } }
        .set-form-group { display: flex; flex-direction: column; gap: 6px; }
        .set-label { font-size: 0.8rem; font-weight: 700; color: #334155; display: flex; align-items: center; gap: 6px; }
        .set-input { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; color: #0f172a; font-size: 0.88rem; outline: none; transition: all 0.2s; box-sizing: border-box; width: 100%; }
        .set-input:focus { border-color: #00AEEF; box-shadow: 0 0 0 3px rgba(0,174,239,0.15); }

        .set-form-footer { display: flex; justify-content: flex-end; padding-top: 12px; border-top: 1px solid #e2e8f0; }
        .set-save-btn { background: #00AEEF; border: none; color: #ffffff; border-radius: 10px; padding: 10px 20px; font-size: 0.86rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s; box-shadow: 0 4px 12px rgba(0,174,239,0.25); }
        .set-save-btn:hover { background: #0090C8; }
        .set-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
