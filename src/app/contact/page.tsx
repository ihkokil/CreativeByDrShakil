"use client";

import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import Footer from '@/components/Footer/Footer';
import styles from './Contact.module.css';
import { ArrowRight, CheckCircle2, ImagePlus, Loader2, Mail, Phone, X } from 'lucide-react';

type IssueType = '' | 'query' | 'technical_assistance' | 'billing' | 'course_access' | 'other';

type SelectedImage = {
  file: File;
  previewUrl: string;
};

const ISSUE_OPTIONS: Array<{ value: IssueType; label: string }> = [
  { value: 'query', label: 'Query' },
  { value: 'technical_assistance', label: 'Technical assistance' },
  { value: 'billing', label: 'Billing' },
  { value: 'course_access', label: 'Course access' },
  { value: 'other', label: 'Other' },
];

const MAX_IMAGES = 3;

export default function ContactPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('');
  const [subject, setSubject] = useState('');
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

  const issueLabel = useMemo(
    () => ISSUE_OPTIONS.find((option) => option.value === issueType)?.label || 'Query',
    [issueType]
  );

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    if (images.length + files.length > MAX_IMAGES) {
      setError(`You can upload up to ${MAX_IMAGES} images.`);
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
    setPhone('');
    setEmail('');
    setIssueType('');
    setSubject('');
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
      formData.append('phone', phone);
      formData.append('email', email);
      formData.append('issueType', issueType);
      formData.append('subject', subject);
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
        setError(data?.error || 'We could not submit your request. Please try again.');
        return;
      }

      setSuccess({
        submissionId: data?.submission?.id || 'received',
        text: 'Your message has been sent. Our support team will review it and reply by email.',
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
          <p className={styles.kicker}>Support</p>
          <h1>Contact our team</h1>
          <p className={styles.lead}>
            Send us your question, issue, or feedback. We’ll reply by email and keep a record inside the admin dashboard so nothing gets lost.
          </p>
          <div className={styles.heroPills}>
            <span><Mail size={16} /> support inbox</span>
            <span><Phone size={16} /> responsive follow-up</span>
            <span><CheckCircle2 size={16} /> tracked in admin panel</span>
          </div>
        </div>
      </section>

      <section className={styles.contentWrap}>
        <form className={`${styles.formCard} glass`} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
            <div>
              <p className={styles.formKicker}>Send a message</p>
              <h2>We’ll route it to the right team</h2>
            </div>
            <div className={styles.supportTag}>Issue: {issueLabel}</div>
          </div>

          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span>Full name</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>

          <div className={styles.row}>
            <label className={styles.field}>
              <span>Phone</span>
              <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required />
            </label>
            <label className={styles.field}>
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
          </div>

          <div className={styles.issueSubjectRow}>
            <label className={`${styles.field} ${styles.issueField}`}>
              <span>Issue</span>
              <select value={issueType} onChange={(event) => setIssueType(event.target.value as IssueType)}>
                <option value="" disabled>Select type</option>
                {ISSUE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={`${styles.field} ${styles.subjectField}`}>
              <span>Subject</span>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} required />
            </label>
          </div>

          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span>Message</span>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={7} required />
          </label>

          <div className={styles.uploadBlock}>
            <div className={styles.uploadHeader}>
              <div>
                <h3>Attach images</h3>
                <p>Upload up to 3 screenshots or reference images.</p>
              </div>
              <span>{images.length}/{MAX_IMAGES}</span>
            </div>

            <label className={`${styles.uploadButton} ${!canAddMore ? styles.uploadDisabled : ''}`}>
              <ImagePlus size={18} />
              <span>{canAddMore ? 'Choose images' : 'Image limit reached'}</span>
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

          {error && <p className={styles.error}>{error}</p>}
          {success && (
            <div className={styles.successBox}>
              <CheckCircle2 size={18} />
              <div>
                <strong>Message sent</strong>
                <p>{success.text}</p>
                <small>Reference: {success.submissionId}</small>
              </div>
            </div>
          )}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? <Loader2 size={18} className={styles.spin} /> : null}
            {loading ? 'Sending...' : 'Send message'}
            {!loading ? <ArrowRight size={18} /> : null}
          </button>
        </form>

        <aside className={styles.sideCard}>
          <div className={styles.sidePanel}>
            <p className={styles.formKicker}>Before you send</p>
            <h3>We’ll help faster if you include screenshots</h3>
            <ul>
              <li>Use the issue dropdown to route your request to the right team.</li>
              <li>Include the course name, feature, or dashboard section.</li>
              <li>Mention when the issue started and what you already tried.</li>
              <li>Attach clear screenshots with errors or unexpected behavior.</li>
              <li>Keep one request per topic so tracking stays clean.</li>
            </ul>
            <div className={styles.tipGrid}>
              <div>
                <strong>Response window</strong>
                <p>Usually within 12-24 hours on working days.</p>
              </div>
              <div>
                <strong>High priority</strong>
                <p>Billing and access requests are reviewed first.</p>
              </div>
            </div>
          </div>

          <div className={styles.sidePanelAlt}>
            <p className={styles.formKicker}>What happens next</p>
            <div className={styles.timeline}>
              <div><strong>1.</strong><span>We store your request in the admin inbox.</span></div>
              <div><strong>2.</strong><span>An admin receives email notification immediately.</span></div>
              <div><strong>3.</strong><span>You get a response by email when handled.</span></div>
            </div>
            <div className={styles.contactMini}>
              <a href="mailto:contact@drshakil.com">contact@drshakil.com</a>
              <a href="tel:+8801700000000">+880 1700-000000</a>
            </div>
          </div>
        </aside>
      </section>

      <Footer />
    </main>
  );
}