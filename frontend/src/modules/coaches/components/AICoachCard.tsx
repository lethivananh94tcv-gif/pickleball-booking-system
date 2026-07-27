import React from 'react';
import Link from 'next/link';
import styles from './AICoachCard.module.css';
import { formatCurrency } from '@/utils/formatCurrency';
import { getCoachImageUrl } from '@/utils/image';
import type { Coach } from '@/types/coach';

export type CoachScoreResult = {
  coach: Coach;
  score: number;
  reasons: string[];
  fallback?: boolean;
};

interface AICoachCardProps {
  coachResult: CoachScoreResult;
  isBestMatch?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

const AICoachCard: React.FC<AICoachCardProps> = ({ 
  coachResult, 
  isBestMatch = false,
  isFavorite = false,
  onToggleFavorite
}) => {
  const { coach, score, reasons } = coachResult;
  
  // Fake reasons if empty
  const displayReasons = reasons && reasons.length > 0 ? reasons : [
    `Phù hợp trình độ ${coach.SkillLevel}`,
    'Giáo án dễ hiểu, cơ bản',
    'Coach kiên nhẫn',
    'Lịch rảnh phù hợp với bạn'
  ];

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={`${styles.badge} ${isBestMatch ? styles.bestMatch : styles.alternative}`}>
          {isBestMatch ? '🏆 BEST MATCH' : '🤖 ALTERNATIVE'}
        </div>
        <button 
          onClick={onToggleFavorite}
          className={`${styles.favoriteBtn} ${isFavorite ? styles.isFavorite : ""}`}
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      </div>

      <div className={styles.coachInfo}>
        <img 
          src={getCoachImageUrl(coach.AvatarURL)} 
          alt={coach.FullName} 
          className={styles.avatar}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.src.includes('hlv1.png')) {
              target.src = "/images/coaches/hlv1.png";
            }
          }}
        />
        <div className={styles.details}>
          <h3 className={styles.name}>{coach.FullName}</h3>
          <p className={styles.meta}>⭐ {Number(coach.AverageRating || 0).toFixed(1)} • {coach.ExperienceYears || 0} năm kinh nghiệm</p>
          <p className={styles.specialization}>Chuyên môn: {coach.Specialization || coach.SkillLevel}</p>
          <div className={styles.tags}>
            <span className={styles.tag}>{coach.SkillLevel}</span>
            <span className={styles.tag}>{coach.Specialization || 'Pickleball'}</span>
          </div>
        </div>
      </div>

      <div className={styles.middleSection}>
        <div className={styles.scoreSection}>
          <div className={styles.scoreHeader}>✨ AI Match Score</div>
          <div className={styles.scoreValue}>{score}%</div>
          <div className={styles.progressBg}>
            <div className={styles.progressFill} style={{ width: `${score}%` }}></div>
          </div>
        </div>

        <div className={styles.reasons}>
          <div className={styles.reasonsTitle}>Lý do phù hợp</div>
          {displayReasons.slice(0, 4).map((reason, idx) => (
            <div key={idx} className={styles.reasonItem}>
              <span className={styles.checkIcon}>✓</span>
              <span>{reason}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.price}>
          {formatCurrency(coach.HourlyRate)} <br/><span>/ giờ</span>
        </div>
        <div className={styles.actions}>
          <Link href={`/coaches/${coach.CoachID}`} className={styles.btnView}>
            Xem hồ sơ
          </Link>
          <Link href={`/coaches/${coach.CoachID}#booking-section`} className={styles.btnBook}>
            Đặt lịch ngay
          </Link>
        </div>
      </div>
    </article>
  );
};

export default AICoachCard;
