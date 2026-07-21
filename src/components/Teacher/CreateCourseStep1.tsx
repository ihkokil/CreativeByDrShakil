"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Upload, Calendar } from "lucide-react";
import Image from "next/image";
import styles from "./CreateCourseStep1.module.css";
import { formatDisplayDate, parseDisplayDateToIso } from "@/lib/date-format";

function CreateCourseStep1Content({ courseId }: { courseId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState(0);
  const [salePrice, setSalePrice] = useState<number | null>(null);
  const [isFeatured, setIsFeatured] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  // Fetch course data if editing
  useEffect(() => {
    const init = async () => {
      try {
        // If editing, fetch existing course
        if (courseId) {
          const token = localStorage.getItem("auth_token");
          const courseResponse = await fetch(`/api/teacher/courses/${courseId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          if (courseResponse.ok) {
            const data = await courseResponse.json();
            const course = data.course;
            setTitle(course.title || "");
            setPrice(course.price || 0);
            setSalePrice(course.salePrice || null);
            setIsFeatured(Boolean(course.isFeatured));
            setImagePreview(course.imageUrl || "");
          }
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [courseId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("auth_token");
      let imageUrl = imagePreview;

      // Upload image if new one selected
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!uploadResponse.ok) throw new Error("Image upload failed");
        const uploadData = await uploadResponse.json();
        imageUrl = uploadData.url;
      }

      const url = `/api/teacher/courses${courseId ? `/${courseId}` : ""}`;

      const response = await fetch(url, {
        method: courseId ? "PATCH" : "POST",
        body: JSON.stringify({
          title: title.trim(),
          price: parseFloat(price.toString()),
          salePrice: salePrice ? parseFloat(salePrice.toString()) : null,
          duration: "1 year",
          imageUrl,
          isFeatured,
        }),
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save course");
      }

      const data = await response.json();
      const newCourseId = courseId || data.course.id;

      // Navigate to step 2
      router.push(`/teacher/dashboard/courses/${newCourseId}/content`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save course");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Create Course</h1>
          <p className={styles.subtitle}>Step 1 of 4: Basic Information</p>
        </div>
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: "25%" }} />
          </div>
          <span className={styles.progressText}>25%</span>
        </div>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Course Details</h2>
          <p className={styles.sectionDesc}>Enter basic information about your course</p>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Course Title <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g., Advanced Diagnostic Techniques"
              className={styles.input}
              required
            />
          </div>
        </div>

        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Course Thumbnail (Optional)</h2>
          <p className={styles.sectionDesc}>Upload a cover image for your course</p>

          <div className={styles.uploadArea}>
            {imagePreview ? (
              <div className={styles.previewContainer}>
                <Image
                  src={imagePreview}
                  alt="Course thumbnail"
                  width={300}
                  height={200}
                  className={styles.previewImage}
                  unoptimized
                />
                <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                  <button
                    type="button"
                    className={styles.changeBtn}
                    onClick={() => document.getElementById("imageInput")?.click()}
                  >
                    <Upload size={20} /> Change
                  </button>
                  <button
                    type="button"
                    className={styles.changeBtn}
                    style={{ background: "#fee2e2", color: "#ef4444", border: "1px solid #fca5a5" }}
                    onClick={() => {
                      setImagePreview("");
                      setImageFile(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className={styles.uploadLabel} htmlFor="imageInput">
                <Upload size={32} />
                <span>Click to upload or drag and drop</span>
                <small>PNG, JPG, GIF up to 5MB</small>
              </label>
            )}
            <input
              id="imageInput"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className={styles.hiddenInput}
            />
          </div>
        </div>

        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Pricing</h2>
          <p className={styles.sectionDesc}>Set the course price and discount</p>

          <div className={styles.priceRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Price <span className={styles.required}>*</span>
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className={styles.input}
                min="0"
                step="0.01"
                required
              />
              <p className={styles.hint}>৳ BDT</p>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Sale Price (Optional)</label>
              <input
                type="number"
                value={salePrice || ""}
                onChange={(e) => setSalePrice(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Discounted price"
                className={styles.input}
                min="0"
                step="0.01"
              />
              <p className={styles.hint}>Leave empty for no discount</p>
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Homepage Feature</h2>

          <div className={styles.durationRow}>

            <div className={styles.formGroup}>
              <label className={styles.label}>Homepage Feature</label>
              <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                />
                <span>Show this course in the homepage upcoming most popular course section</span>
              </label>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => router.push("/teacher/dashboard/courses")}
            className={styles.cancelBtn}
            disabled={submitting || loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting || loading}
          >
            {submitting ? "Saving..." : "Next"}
            <ArrowRight size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CreateCourseStep1({ courseId }: { courseId?: string }) {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <CreateCourseStep1Content courseId={courseId} />
    </Suspense>
  );
}
