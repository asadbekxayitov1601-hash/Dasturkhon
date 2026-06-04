import { useState, useEffect, useRef } from 'react';
import { Star, Camera, Trash2, Pencil, X, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import {
  Review,
  getRecipeReviews,
  getMyReview,
  createReview,
  updateReview,
  deleteReview,
  averageRating,
} from '../api/reviewsApi';

interface ReviewSectionProps {
  recipeId: string | number;
}

// ─── Star rating input ────────────────────────────────────────────────────────
function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <Star
            className="w-7 h-7"
            fill={(hovered || value) >= star ? 'var(--accent)' : 'none'}
            stroke={(hovered || value) >= star ? 'var(--accent)' : '#C4B49A'}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Static star display ──────────────────────────────────────────────────────
function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cls}
          fill={rating >= star ? 'var(--accent)' : 'none'}
          stroke={rating >= star ? 'var(--accent)' : '#C4B49A'}
        />
      ))}
    </div>
  );
}

// ─── Single review card ───────────────────────────────────────────────────────
function ReviewCard({
  review,
  isOwner,
  onEdit,
  onDelete,
}: {
  review: Review;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const displayName = review.user.name || review.user.email.split('@')[0];
  const initials = displayName.slice(0, 2).toUpperCase();
  const date = new Date(review.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const [isEditHovered, setIsEditHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);

  return (
    <div 
      className="bg-white rounded-[20px] p-4 shadow-sm"
      style={{ border: '1px solid rgba(74, 124, 126, 0.12)' }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div 
          className="w-10 h-10 rounded-full text-white flex items-center justify-center text-sm font-semibold flex-shrink-0"
          style={{ background: 'linear-gradient(to bottom right, var(--primary), rgba(74, 124, 126, 0.6))' }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="font-medium text-sm" style={{ color: '#2C3E3F' }}>{displayName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <StarDisplay rating={review.rating} />
                <span className="text-xs" style={{ color: '#8A9A9B' }}>{date}</span>
              </div>
            </div>
            {isOwner && (
              <div className="flex gap-1">
                <button
                  onClick={onEdit}
                  className="p-1.5 rounded-full transition-colors"
                  style={{ 
                    backgroundColor: isEditHovered ? 'var(--muted)' : 'transparent',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={() => setIsEditHovered(true)}
                  onMouseLeave={() => setIsEditHovered(false)}
                  title="Edit review"
                >
                  <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-full transition-colors"
                  style={{ 
                    backgroundColor: isDeleteHovered ? 'var(--muted)' : 'transparent',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={() => setIsDeleteHovered(true)}
                  onMouseLeave={() => setIsDeleteHovered(false)}
                  title="Delete review"
                >
                  <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--secondary)' }} />
                </button>
              </div>
            )}
          </div>

          {review.comment && (
            <p className="text-sm mt-2 leading-relaxed" style={{ color: '#3C4849' }}>{review.comment}</p>
          )}

          {review.photoUrl && (
            <div className="mt-3">
              <img
                src={review.photoUrl}
                alt="Cooked dish"
                className="rounded-[12px] max-h-48 object-cover w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Review form (create / edit) ──────────────────────────────────────────────
function ReviewForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<Review>;
  onSubmit: (data: { rating: number; comment: string; photoUrl?: string }) => void;
  onCancel?: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(initial?.rating || 0);
  const [comment, setComment] = useState(initial?.comment || '');
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(
    initial?.photoUrl || undefined
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const [isPhotoHovered, setIsPhotoHovered] = useState(false);
  const [isPhotoCloseHovered, setIsPhotoCloseHovered] = useState(false);
  const [isSubmitHovered, setIsSubmitHovered] = useState(false);
  const [isCancelHovered, setIsCancelHovered] = useState(false);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error(t('reviews.photo_too_large'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (rating === 0) {
      toast.error(t('reviews.rating_required'));
      return;
    }
    onSubmit({ rating, comment, photoUrl: photoPreview });
  };

  return (
    <div 
      className="rounded-[20px] p-5"
      style={{ 
        background: 'linear-gradient(to bottom right, rgba(74, 124, 126, 0.05), rgba(230, 181, 102, 0.05))',
        border: '1px solid rgba(74, 124, 126, 0.12)' 
      }}
    >
      <p className="text-sm font-medium mb-3" style={{ color: '#3C4849' }}>{t('reviews.your_rating')}</p>
      <StarInput value={rating} onChange={setRating} />

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('reviews.comment_placeholder')}
        className="mt-4 w-full rounded-[14px] bg-white px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 resize-none"
        style={{ 
          border: '1px solid rgba(74, 124, 126, 0.12)',
          color: '#2C3E3F',
          outlineColor: 'rgba(74, 124, 126, 0.3)'
        }}
        rows={3}
      />

      {/* Photo upload */}
      <div className="mt-3">
        {photoPreview ? (
          <div className="relative inline-block">
            <img
              src={photoPreview}
              alt="preview"
              className="h-28 rounded-[12px] object-cover"
            />
            <button
              onClick={() => setPhotoPreview(undefined)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center transition-colors"
              style={{
                backgroundColor: isPhotoCloseHovered ? 'var(--muted)' : 'white',
                border: 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={() => setIsPhotoCloseHovered(true)}
              onMouseLeave={() => setIsPhotoCloseHovered(false)}
            >
              <X className="w-3 h-3" style={{ color: 'var(--secondary)' }} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 text-sm transition-colors px-3 py-2 rounded-[10px] border border-dashed"
            style={{
              borderColor: isPhotoHovered ? 'var(--primary)' : 'rgba(74, 124, 126, 0.12)',
              color: 'var(--primary)',
              backgroundColor: isPhotoHovered ? 'var(--muted)' : 'transparent',
              cursor: 'pointer'
            }}
            onMouseEnter={() => setIsPhotoHovered(true)}
            onMouseLeave={() => setIsPhotoHovered(false)}
          >
            <Camera className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            {t('reviews.add_photo')}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhoto}
        />
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-full text-sm font-medium transition-all disabled:opacity-60"
          style={{
            backgroundColor: 'var(--primary)',
            opacity: isSubmitHovered ? 0.9 : 1,
            cursor: 'pointer'
          }}
          onMouseEnter={() => setIsSubmitHovered(true)}
          onMouseLeave={() => setIsSubmitHovered(false)}
        >
          {loading ? (
            <span className="animate-pulse">{t('reviews.submitting')}</span>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              {t('reviews.submit')}
            </>
          )}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
            style={{
              backgroundColor: isCancelHovered ? 'var(--muted)' : 'transparent',
              color: '#3C4849',
              cursor: 'pointer'
            }}
            onMouseEnter={() => setIsCancelHovered(true)}
            onMouseLeave={() => setIsCancelHovered(false)}
          >
            {t('common.close')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main ReviewSection ───────────────────────────────────────────────────────
export function ReviewSection({ recipeId }: ReviewSectionProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  const [isWriteHovered, setIsWriteHovered] = useState(false);

  // Load reviews on mount
  useEffect(() => {
    loadReviews();
  }, [recipeId]);

  async function loadReviews() {
    setLoading(true);
    try {
      const [all, mine] = await Promise.all([
        getRecipeReviews(recipeId),
        user ? getMyReview(recipeId) : Promise.resolve(null),
      ]);
      setReviews(all);
      setMyReview(mine);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(data: { rating: number; comment: string; photoUrl?: string }) {
    setSubmitting(true);
    try {
      const review = await createReview(recipeId, data);
      setMyReview(review);
      setReviews((prev) => [review, ...prev]);
      setShowForm(false);
      toast.success(t('reviews.submitted_success'));
    } catch (e: any) {
      toast.error(e.message || t('reviews.submit_error'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(data: { rating: number; comment: string; photoUrl?: string }) {
    if (!editingReview) return;
    setSubmitting(true);
    try {
      const updated = await updateReview(editingReview.id, data);
      setMyReview(updated);
      setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditingReview(null);
      toast.success(t('reviews.updated_success'));
    } catch (e: any) {
      toast.error(e.message || t('reviews.submit_error'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(reviewId: number) {
    try {
      await deleteReview(reviewId);
      setMyReview(null);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      toast.success(t('reviews.deleted_success'));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const avg = averageRating(reviews);
  const count = reviews.length;

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-semibold" style={{ color: '#2C3E3F' }}>{t('reviews.title')}</h3>
          {count > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <StarDisplay rating={Math.round(avg)} size="md" />
              <span className="text-sm" style={{ color: '#8A9A9B' }}>
                {avg.toFixed(1)} · {count} {count === 1 ? t('reviews.review') : t('reviews.reviews')}
              </span>
            </div>
          )}
        </div>

        {/* Show "Write a review" button only if logged in and hasn't reviewed yet */}
        {user && !myReview && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-white rounded-full text-sm font-medium transition-all"
            style={{
              backgroundColor: 'var(--primary)',
              boxShadow: '0 4px 6px -1px rgba(74, 124, 126, 0.2)',
              opacity: isWriteHovered ? 0.9 : 1,
              cursor: 'pointer'
            }}
            onMouseEnter={() => setIsWriteHovered(true)}
            onMouseLeave={() => setIsWriteHovered(false)}
          >
            <Star className="w-4 h-4" />
            {t('reviews.write_review')}
          </button>
        )}
      </div>

      {/* New review form */}
      {user && showForm && !myReview && (
        <div className="mb-5">
          <ReviewForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            loading={submitting}
          />
        </div>
      )}

      {/* Not logged in nudge */}
      {!user && (
        <p className="text-sm mb-5 italic" style={{ color: '#8A9A9B' }}>
          {t('reviews.login_to_review')}
        </p>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div 
              key={i} 
              className="rounded-[20px] animate-pulse h-20" 
              style={{ backgroundColor: 'var(--muted)' }}
            />
          ))}
        </div>
      )}

      {/* Reviews list */}
      {!loading && (
        <div className="space-y-3">
          {reviews.length === 0 && (
            <div className="text-center py-10 text-sm font-medium" style={{ color: '#8A9A9B' }}>
              {t('reviews.no_reviews')}
            </div>
          )}

          {reviews.map((review) => {
            const isOwner = user ? Number(user.id) === review.userId : false;
            return editingReview?.id === review.id ? (
              <ReviewForm
                key={review.id}
                initial={review}
                onSubmit={handleUpdate}
                onCancel={() => setEditingReview(null)}
                loading={submitting}
              />
            ) : (
              <ReviewCard
                key={review.id}
                review={review}
                isOwner={isOwner}
                onEdit={() => setEditingReview(review)}
                onDelete={() => handleDelete(review.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
