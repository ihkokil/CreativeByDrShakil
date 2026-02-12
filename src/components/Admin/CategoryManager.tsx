'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './CategoryManager.module.css';
import { fetchCategories, CategorySummary } from '@/lib/categories';
import { Loader2, RefreshCw, Save, Plus, PencilLine, Trash2 } from 'lucide-react';

type CategoryForm = {
  name: string;
  displayName: string;
};

const DEFAULT_FORM: CategoryForm = {
  name: '',
  displayName: '',
};

export default function CategoryManager() {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(DEFAULT_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const token = useMemo(() => localStorage.getItem('auth_token'), []);

  const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const jsonHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const loadCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchCategories();
      setCategories(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        displayName: form.displayName.trim() || form.name.trim(),
      };

      if (!payload.name) {
        throw new Error('Category name is required.');
      }

      const isEditing = Boolean(editingId);
      const endpoint = isEditing ? `/api/categories/${editingId}` : '/api/categories';
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save category.');
      }

      setSuccess(isEditing ? 'Category updated successfully.' : 'Category created successfully.');
      resetForm();
      await loadCategories();
    } catch (err: any) {
      setError(err?.message || 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category: CategorySummary) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      displayName: category.displayName,
    });
    setError('');
    setSuccess('');
  };

  const handleDelete = async (category: CategorySummary) => {
    const confirmed = window.confirm(`Delete category ${category.displayName}? Courses using it will become uncategorized.`);
    if (!confirmed) return;

    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/categories/${category.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to delete category.');
      }

      if (editingId === category.id) {
        resetForm();
      }

      setSuccess(`Category ${category.displayName} deleted.`);
      await loadCategories();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete category.');
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.formCard}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.kicker}>Course taxonomy</p>
            <h3>{editingId ? 'Edit category' : 'Create category'}</h3>
          </div>
          {editingId && (
            <button className={styles.ghostBtn} type="button" onClick={resetForm}>
              Cancel edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>System name</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="FCPS"
              required
            />
          </div>

          <div className={styles.field}>
            <label>Display name</label>
            <input
              type="text"
              value={form.displayName}
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
              placeholder="FCPS"
            />
          </div>

          <div className={styles.formActions}>
            <button className={styles.primaryBtn} type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className={styles.spin} /> : editingId ? <Save size={16} /> : <Plus size={16} />}
              {editingId ? 'Update category' : 'Add category'}
            </button>
          </div>
        </form>

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
      </section>

      <section className={styles.listCard}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.kicker}>Database-backed</p>
            <h3>Existing categories</h3>
          </div>
          <button className={styles.secondaryBtn} type="button" onClick={loadCategories}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <Loader2 size={18} className={styles.spin} /> Loading categories...
          </div>
        ) : categories.length === 0 ? (
          <div className={styles.emptyState}>No categories found.</div>
        ) : (
          <div className={styles.categoryList}>
            {categories.map((category) => (
              <article key={category.id} className={styles.categoryRow}>
                <div>
                  <strong>{category.displayName}</strong>
                  <span>{category.name}</span>
                </div>
                <div className={styles.actions}>
                  <button className={styles.ghostBtn} type="button" onClick={() => handleEdit(category)}>
                    <PencilLine size={14} /> Edit
                  </button>
                  <button className={styles.dangerBtn} type="button" onClick={() => handleDelete(category)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}