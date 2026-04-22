// src/features/shop/components/ReviewSection.tsx
import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../../hooks/useTheme';
import AppText from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { withOpacity } from '../../../utils/withOpacity';
import { useProductReviews, useAddReview } from '../hooks/useShop';
import type { Review } from '../types/shop.types';
import { useAuthStore } from '../../auth/store/authStore';

// ─── Star Picker ──────────────────────────────────────────────────────────────

const StarPicker = memo(({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <View style={{ flexDirection: 'row', gap: 8 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <TouchableOpacity key={i} onPress={() => onChange(i)} activeOpacity={0.7}>
        <Icon name="Star" size={32} color={i <= value ? '#F59E0B' : '#D1D5DB'} filled={i <= value} />
      </TouchableOpacity>
    ))}
  </View>
));
StarPicker.displayName = 'StarPicker';

// ─── Star Display ─────────────────────────────────────────────────────────────

const StarDisplay = memo(({ rating, size = 13 }: { rating: number; size?: number }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <Icon key={i} name="Star" size={size} color={i <= Math.round(rating) ? '#F59E0B' : '#D1D5DB'} filled={i <= Math.round(rating)} />
    ))}
  </View>
));
StarDisplay.displayName = 'StarDisplay';

// ─── Rating Breakdown Bar ─────────────────────────────────────────────────────

const BreakdownBar = memo(({ star, count, total, color }: { star: number; count: number; total: number; color: string }) => {
  const { colors } = useTheme();
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={styles.breakdownRow}>
      <AppText variant="caption2" style={{ width: 14, color: colors.mutedForeground }}>{star}</AppText>
      <Icon name="Star" size={10} color="#F59E0B" filled />
      <View style={[styles.breakdownTrack, { backgroundColor: colors.secondary }]}>
        <View style={[styles.breakdownFill, { width: `${pct}%` as any, backgroundColor: '#F59E0B' }]} />
      </View>
      <AppText variant="caption2" style={{ width: 24, textAlign: 'right', color: colors.mutedForeground }}>{count}</AppText>
    </View>
  );
});
BreakdownBar.displayName = 'BreakdownBar';

// ─── Review Card ──────────────────────────────────────────────────────────────

const ReviewCard = memo(({ review }: { review: Review }) => {
  const { colors } = useTheme();
  const initials = review.user?.name?.charAt(0)?.toUpperCase() ?? '?';
  const date = new Date(review.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.reviewHeader}>
        <View style={[styles.avatar, { backgroundColor: withOpacity(colors.primary, 0.15) }]}>
          <AppText variant="subhead" weight="bold" style={{ color: colors.primary }}>{initials}</AppText>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <AppText variant="subhead" weight="semiBold">{review.user?.name ?? 'User'}</AppText>
          <AppText variant="caption2" style={{ color: colors.mutedForeground, marginTop: 1 }}>{date}</AppText>
        </View>
        <StarDisplay rating={review.rating} />
      </View>
      {!!review.comment && (
        <AppText variant="body" style={{ marginTop: 10, lineHeight: 22, color: colors.foreground }}>
          {review.comment}
        </AppText>
      )}
    </Animated.View>
  );
});
ReviewCard.displayName = 'ReviewCard';

// ─── Write Review Modal ───────────────────────────────────────────────────────

type WriteReviewModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
  isPending: boolean;
};

const WriteReviewModal = memo(({ visible, onClose, onSubmit, isPending }: WriteReviewModalProps) => {
  const { colors } = useTheme();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    if (rating === 0) return;
    onSubmit(rating, comment.trim());
  };

  const handleClose = () => {
    setRating(0);
    setComment('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose} />
      <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
        <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

        <AppText variant="title3" weight="bold" style={{ marginBottom: 20 }}>Write a Review</AppText>

        {/* Star picker */}
        <AppText variant="subhead" weight="semiBold" style={{ marginBottom: 12, color: colors.mutedForeground }}>
          Your Rating
        </AppText>
        <StarPicker value={rating} onChange={setRating} />
        {rating > 0 && (
          <AppText variant="caption1" style={{ marginTop: 8, color: '#F59E0B' }}>
            {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
          </AppText>
        )}

        {/* Comment */}
        <AppText variant="subhead" weight="semiBold" style={{ marginTop: 20, marginBottom: 8, color: colors.mutedForeground }}>
          Your Review (optional)
        </AppText>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Share your experience with this product…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={4}
          style={[styles.commentInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
        />

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={rating === 0 || isPending}
          style={[
            styles.submitBtn,
            { backgroundColor: rating === 0 ? colors.mutedForeground : '#92400E', opacity: rating === 0 ? 0.5 : 1 },
          ]}
          activeOpacity={0.8}
        >
          {isPending
            ? <ActivityIndicator size="small" color="#FEF3C7" />
            : <AppText variant="subhead" weight="bold" color="#FEF3C7">Submit Review</AppText>}
        </TouchableOpacity>
      </View>
    </Modal>
  );
});
WriteReviewModal.displayName = 'WriteReviewModal';

// ─── Main ReviewSection ───────────────────────────────────────────────────────

type Props = {
  productId: string;
  initialRating: number;
  initialReviewCount: number;
};

const ReviewSection = ({ productId, initialRating, initialReviewCount }: Props) => {
  const { colors } = useTheme();
  const user = useAuthStore(s => s.user);

  const [modalVisible, setModalVisible] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [breakdown, setBreakdown] = useState<Record<string, number>>({});
  const [rating, setRating] = useState(initialRating);
  const [reviewCount, setReviewCount] = useState(initialReviewCount);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const { mutate: fetchReviews, isPending: isLoadingReviews } = useProductReviews(productId);
  const { mutate: submitReview, isPending: isSubmitting } = useAddReview(productId);

  const loadReviews = useCallback((p = 1) => {
    fetchReviews({ page: p, limit: 5 }, {
      onSuccess: res => {
        if (!res.success || !res.data) return;
        setReviews(prev => p === 1 ? res.data!.reviews : [...prev, ...res.data!.reviews]);
        setBreakdown(res.data.breakdown);
        setRating(res.data.rating);
        setReviewCount(res.data.reviewCount);
        setHasMore(res.data.pagination.hasMore);
        setPage(p);
      },
    });
  }, [fetchReviews]);

  useEffect(() => { loadReviews(1); }, [loadReviews]);

  const handleSubmit = useCallback((stars: number, comment: string) => {
    submitReview({ rating: stars, comment }, {
      onSuccess: res => {
        if (!res.success) return;
        setModalVisible(false);
        loadReviews(1); // refresh
      },
    });
  }, [submitReview, loadReviews]);

  return (
    <View style={{ marginTop: 24 }}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <AppText variant="title3" weight="bold">Reviews</AppText>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={[styles.writeBtn, { backgroundColor: withOpacity('#92400E', 0.08), borderColor: withOpacity('#92400E', 0.3) }]}
          activeOpacity={0.75}
        >
          <Icon name="PenLine" size={14} color="#92400E" />
          <AppText variant="caption1" weight="semiBold" color="#92400E" style={{ marginLeft: 5 }}>Write Review</AppText>
        </TouchableOpacity>
      </View>

      {/* Rating summary */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryLeft}>
          <AppText style={styles.bigRating}>{rating.toFixed(1)}</AppText>
          <StarDisplay rating={rating} size={16} />
          <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 4 }}>
            {reviewCount} review{reviewCount !== 1 ? 's' : ''}
          </AppText>
        </View>
        <View style={styles.summaryRight}>
          {[5, 4, 3, 2, 1].map(star => (
            <BreakdownBar key={star} star={star} count={breakdown[star] ?? 0} total={reviewCount} color="#F59E0B" />
          ))}
        </View>
      </View>

      {/* Review list */}
      {isLoadingReviews && reviews.length === 0 ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : reviews.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <AppText style={{ fontSize: 32 }}>💬</AppText>
          <AppText variant="subhead" weight="semiBold" style={{ marginTop: 10 }}>No reviews yet</AppText>
          <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 4, textAlign: 'center' }}>
            Be the first to share your experience!
          </AppText>
        </View>
      ) : (
        <View style={{ gap: 10, marginTop: 12 }}>
          {reviews.map(r => <ReviewCard key={r._id} review={r} />)}
          {hasMore && (
            <TouchableOpacity
              onPress={() => loadReviews(page + 1)}
              style={[styles.loadMoreBtn, { borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              {isLoadingReviews
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <AppText variant="subhead" weight="semiBold" style={{ color: colors.primary }}>Load more reviews</AppText>}
            </TouchableOpacity>
          )}
        </View>
      )}

      <WriteReviewModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
        isPending={isSubmitting}
      />
    </View>
  );
};

export default ReviewSection;

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  writeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },

  summaryCard: { flexDirection: 'row', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 16 },
  summaryLeft: { alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  bigRating: { fontSize: 44, fontWeight: '800', color: '#F59E0B', lineHeight: 50 },
  summaryRight: { flex: 1, gap: 5, justifyContent: 'center' },

  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breakdownTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  breakdownFill: { height: 6, borderRadius: 3 },

  reviewCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  emptyCard: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 24, alignItems: 'center' },
  loadMoreBtn: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  commentInput: {
    borderRadius: 12, borderWidth: 1, padding: 12,
    fontSize: 15, lineHeight: 22, minHeight: 100,
    textAlignVertical: 'top',
  },
  submitBtn: { marginTop: 20, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
