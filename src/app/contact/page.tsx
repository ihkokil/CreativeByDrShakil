"use client";

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import Footer from '@/components/Footer/Footer';
import styles from './Contact.module.css';
import { ArrowRight, CheckCircle2, ImagePlus, Loader2, Mail, MessageSquare, ShieldCheck, X } from 'lucide-react';

type SelectedImage = {
  file: File;
  previewUrl: string;
};

const MAX_IMAGES = 3;

export default function ContactPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ submissionId: string; text: string } | null>(null);

  useEffect(() => {
    return () => {
      images.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
    };
  }, [images]);

  const canAddMore = images.length < MAX_IMAGES;

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    if (images.length + files.length > MAX_IMAGES) {
      setError(`You can upload up to ${MAX_IMAGES} screenshots or images.`);
      event.target.value = '';
      return;
    }

    const newEntries = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setImages((current) => [...current, ...newEntries]);
    setError('');
    event.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages((current) => {
      const next = [...current];
      const [removed] = next.splice(index, 1);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
  };

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setMessage('');
    setImages([]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('email', email);
      if (phone.trim()) {
        formData.append('phone', phone.trim());
      }
      formData.append('message', message);

      images.forEach((entry) => {
        formData.append('images', entry.file);
      });

      const response = await fetch('/api/contact', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || 'We could not submit your message. Please try again.');
        return;
      }

      setSuccess({
        submissionId: data?.submission?.id || 'received',
        text: 'Your message has been sent successfully. Our team will review and reply to you via email shortly.',
      });
      resetForm();
    } catch {
      setError('We could not submit your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <Navbar />

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.kicker}>Support & Feedback</p>
          <h1>Contact our team</h1>
          <p className={styles.lead}>
            Have a question, complaint, or feedback? Send us a message below and we’ll get back to you directly by email.
          </p>
          <div className={styles.heroPills}>
            <span><Mail size={16} /> support@creativebydrshakil.com</span>
            <span><ShieldCheck size={16} /> Verified support inbox</span>
            <span><CheckCircle2 size={16} /> Fast email response</span>
          </div>
        </div>
      </section>

      <section className={styles.contentWrap}>
        <form className={`${styles.formCard} glass`} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
            <div>
              <p className={styles.formKicker}>Send a message</p>
              <h2>How can we help you?</h2>
            </div>
          </div>

          <div className={styles.fieldsStack}>
            <label className={styles.field}>
              <span>Full Name <strong className={styles.requiredMark}>*</strong></span>
              <input
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </label>

            <div className={styles.row}>
              <label className={styles.field}>
                <span>Email Address <strong className={styles.requiredMark}>*</strong></span>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Phone Number <span className={styles.optionalMark}>(Optional)</span></span>
                <input
                  type="tel"
                  placeholder="e.g. 01700-000000"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>Message / Complain <strong className={styles.requiredMark}>*</strong></span>
              <textarea
                placeholder="Describe your question, complain, or issue in detail..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={6}
                required
              />
            </label>

            {/* Optional Image Attachments */}
            <div className={styles.uploadBlock}>
              <div className={styles.uploadHeader}>
                <div>
                  <span className={styles.uploadTitle}>Attach Screenshots / Images</span>
                  <p className={styles.uploadSubtitle}>Upload up to {MAX_IMAGES} reference screenshots (optional).</p>
                </div>
                <span className={styles.uploadCount}>{images.length}/{MAX_IMAGES}</span>
              </div>

              <label className={`${styles.uploadButton} ${!canAddMore ? styles.uploadDisabled : ''}`}>
                <ImagePlus size={18} />
                <span>{canAddMore ? 'Choose screenshots or images' : 'Maximum images selected'}</span>
                <input type="file" accept="image/*" multiple onChange={handleImageChange} disabled={!canAddMore} />
              </label>

              {images.length > 0 && (
                <div className={styles.previewGrid}>
                  {images.map((entry, index) => (
                    <div key={`${entry.file.name}-${index}`} className={styles.previewItem}>
                      <img src={entry.previewUrl} alt={`Attachment ${index + 1}`} />
                      <button type="button" onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {success && (
            <div className={styles.successBox}>
              <CheckCircle2 size={20} className={styles.successIcon} />
              <div>
                <strong>Message Sent Successfully</strong>
                <p>{success.text}</p>
                <small>Reference ID: {success.submissionId}</small>
              </div>
            </div>
          )}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? <Loader2 size={18} className={styles.spin} /> : <MessageSquare size={18} />}
            <span>{loading ? 'Sending...' : 'Send Message / Complain'}</span>
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <aside className={styles.sideCard}>
          <div className={styles.sidePanel}>
            <p className={styles.formKicker}>Support Desk</p>
            <h3>Direct Email Contact</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.7', margin: '8px 0 16px 0' }}>
              You can also reach our official support inbox directly from your email client:
            </p>
            
            <div className={styles.directEmailBox}>
              <Mail size={20} className={styles.directEmailIcon} />
              <div>
                <span style={{ display: 'block', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: '700' }}>Official Support</span>
                <a href="mailto:support@creativebydrshakil.com" className={styles.emailLink}>
                  support@creativebydrshakil.com
                </a>
              </div>
            </div>

            <div className={styles.tipGrid}>
              <div>
                <strong>Response Window</strong>
                <p>Usually within 12–24 hours on working days.</p>
              </div>
              <div>
                <strong>Account & Access</strong>
                <p>Course enrollment and billing inquiries are prioritized.</p>
              </div>
            </div>
          </div>

          <div className={styles.sidePanelAlt}>
            <p className={styles.formKicker}>What happens next?</p>
            <div className={styles.timeline}>
              <div><strong>1.</strong><span>Your message is delivered instantly to our support staff.</span></div>
              <div><strong>2.</strong><span>You receive an automated confirmation email receipt.</span></div>
              <div><strong>3.</strong><span>Our support team reviews your inquiry and replies directly to your email.</span></div>
            </div>
          </div>
        </aside>
      </section>

      <Footer />
    </main>
  );
}