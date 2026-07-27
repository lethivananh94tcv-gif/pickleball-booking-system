"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createMySchedule,
  deleteMySchedule,
  getMyCoachProfile,
  getMyIncome,
  getMyReceivedBookings,
  getMySchedules,
  getScheduleOptions,
  updateMyExpertise,
  updateMyProfile,
  updateMySchedule,
  updateMyTeachingFee,
} from "@/services/coachApi";
import { cancelBookingByCoach } from "@/services/bookingApi";
import StateBox from "@/components/common/StateBox";
import type { Coach, CoachSchedule } from "@/types/coach";
import { formatCurrency } from "@/utils/formatCurrency";
import { getImageUrl } from "@/utils/image";
import styles from "./CoachDashboard.module.css";

type Tab = "profile" | "expertise" | "fee" | "schedules" | "bookings" | "income";

const SKILL_OPTIONS = [
  { value: "Beginner", label: "Beginner - Mới bắt đầu" },
  { value: "Intermediate", label: "Intermediate - Trung cấp" },
  { value: "Advanced", label: "Advanced - Nâng cao" },
  { value: "Professional", label: "Professional - Chuyên nghiệp" },
];

const STATUS_LABELS: Record<string, string> = {
  Available: "Có thể dạy",
  Holding: "Đang giữ chỗ",
  Booked: "Đã được đặt",
  Cancelled: "Đã hủy",
  Unavailable: "Không có mặt",
};

const SCHEDULES_PER_PAGE = 8;

function todayStr() {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function toDateLabel(value?: string) {
  if (!value) return "Chưa có ngày";
  const datePart = value.includes("T") ? value.split("T")[0] : value;
  const date = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(date.getTime())) return datePart;
  return date.toLocaleDateString("vi-VN");
}

function toMonthLabel(value: string) {
  return value.replace("-", "/");
}

function compactCurrency(value: number) {
  if (value >= 1000000) {
    const million = value / 1000000;
    return `${Number.isInteger(million) ? million : million.toFixed(1)}M`;
  }
  return `${Math.round(value / 1000)}K`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateToInputValue(date: Date) {
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateFromMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return new Date();
  return new Date(year, month - 1, 1);
}

interface Props {
  token: string;
}

export default function CoachDashboard({ token }: Props) {
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") || "profile") as Tab;

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState("");

  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPreview, setCertPreview] = useState<string | null>(null);
  const [certError, setCertError] = useState("");

  const [coach, setCoach] = useState<Coach | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");

  const [profileForm, setProfileForm] = useState({
    experienceYears: 0,
    biography: "",
    specialization: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [expertiseForm, setExpertiseForm] = useState({
    skillLevel: "",
    specialization: "",
    certifications: "",
    experienceYears: 0,
  });
  const [expertiseSaving, setExpertiseSaving] = useState(false);
  const [expertiseMsg, setExpertiseMsg] = useState("");

  const [hourlyRate, setHourlyRate] = useState(150000);
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeMsg, setFeeMsg] = useState("");

  const [incomeData, setIncomeData] = useState<any>(null);
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [incomeError, setIncomeError] = useState("");

  const [schedules, setSchedules] = useState<CoachSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    workingDate: todayStr(),
    startTime: "08:00",
    endTime: "09:00",
  });
  const [scheduleFormError, setScheduleFormError] = useState("");
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleActionId, setScheduleActionId] = useState<number | null>(null);
  const [schedulePage, setSchedulePage] = useState(1);

  const [scheduleOptions, setScheduleOptions] = useState<{
    startTimes: string[];
    occupiedHours: number[];
  }>({ startTimes: [], occupiedHours: [] });
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingActionId, setBookingActionId] = useState<number | null>(null);

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmStyle?: "success" | "warning" | "danger";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    confirmStyle: "success",
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setAvatarError("Ảnh đại diện không được vượt quá 3MB.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError("Chỉ hỗ trợ định dạng JPG, PNG hoặc WEBP.");
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleCancelAvatar = () => {
    setAvatarFile(null);
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarPreview(null);
    setAvatarError("");
  };

  const handleCertChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCertError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setCertError("Chứng chỉ không được vượt quá 5MB.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setCertError("Chỉ hỗ trợ định dạng JPG, PNG hoặc WEBP.");
      return;
    }

    setCertFile(file);
    setCertPreview(URL.createObjectURL(file));
  };

  const handleCancelCert = () => {
    setCertFile(null);
    if (certPreview) {
      URL.revokeObjectURL(certPreview);
    }
    setCertPreview(null);
    setCertError("");
  };

  const profileCompletion = useMemo(() => {
    const fields = [
      coach?.AvatarURL,
      profileForm.experienceYears > 0 ? profileForm.experienceYears : null,
      profileForm.specialization,
      profileForm.biography,
      expertiseForm.skillLevel,
      hourlyRate,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [coach, expertiseForm.skillLevel, hourlyRate, profileForm]);

  const availableSchedules = useMemo(
    () =>
      schedules.filter(
        (schedule) => schedule.Status === "Available" && !schedule.isExpired
      ),
    [schedules]
  );

  const nextSchedule = useMemo(() => {
    const now = new Date();
    return availableSchedules
      .filter((schedule) => {
        return new Date(`${schedule.WorkingDate}T${schedule.StartTime}`) >= now;
      })
      .sort((a, b) => {
        const aTime = new Date(`${a.WorkingDate}T${a.StartTime}`).getTime();
        const bTime = new Date(`${b.WorkingDate}T${b.StartTime}`).getTime();
        return aTime - bTime;
      })[0];
  }, [availableSchedules]);

  const sortedBookings = useMemo(() => {
    return bookings.slice().sort((a, b) => {
      const dateA = new Date(a.BookingDate).getTime();
      const dateB = new Date(b.BookingDate).getTime();
      if (dateA !== dateB) return dateB - dateA;

      const timeA = a.StartTime || "00:00";
      const timeB = b.StartTime || "00:00";
      return timeB.localeCompare(timeA);
    });
  }, [bookings]);

  const statusText =
    coach?.Status === "Approved"
      ? "Đã được duyệt"
      : coach?.Status === "Pending"
      ? "Chờ duyệt"
      : coach?.Status === "Inactive"
      ? "Ngừng hoạt động"
      : coach?.Status || "Chưa cập nhật";

  const skillLabel =
    SKILL_OPTIONS.find((option) => option.value === expertiseForm.skillLevel)
      ?.label || "Chưa chọn trình độ";

  const hasCertificate = Boolean(expertiseForm.certifications || certPreview);
  const totalIncome = Number(incomeData?.summary?.totalIncome || 0);
  const completedSessions = Number(incomeData?.summary?.completedSessions || 0);
  const totalWorkingHours = Number(incomeData?.summary?.totalWorkingHours || 0);
  const completedBookings = bookings.filter((b) => b.Status === "Completed").length;
  const cancelledBookings = bookings.filter((b) => b.Status === "Cancelled").length;
  const today = todayStr();
  const todayOpenCount = availableSchedules.filter(
    (schedule) => schedule.WorkingDate === today
  ).length;
  const unavailableCount = schedules.filter(
    (schedule) => schedule.Status === "Unavailable"
  ).length;
  const feePercent = clampPercent(((hourlyRate - 150000) / 1850000) * 100);
  const projectedMonthlyIncome = hourlyRate * 17;

  const scheduleDays = useMemo(() => {
    const base = new Date(`${todayStr()}T00:00:00`);
    return Array.from({ length: 5 }, (_, index) => {
      const date = addDays(base, index);
      const value = dateToInputValue(date);
      const openCount = availableSchedules.filter(
        (schedule) => schedule.WorkingDate === value
      ).length;
      return {
        value,
        day: date.toLocaleDateString("vi-VN", { weekday: "long" }),
        number: date.toLocaleDateString("vi-VN", { day: "2-digit" }),
        openCount,
      };
    });
  }, [availableSchedules]);

  const monthlyIncomeRows = useMemo(
    () => incomeData?.monthlyIncome || [],
    [incomeData]
  );

  const chartMonths = useMemo(() => {
    const incomeByMonth = new Map(
      monthlyIncomeRows.map((month: any) => [
        month.month,
        {
          month: month.month,
          sessions: Number(month.sessions || 0),
          workingHours: Number(month.workingHours || 0),
          income: Number(month.income || 0),
        },
      ])
    );
    const sortedMonthKeys = monthlyIncomeRows
      .map((month: any) => String(month.month || ""))
      .filter(Boolean)
      .sort();
    const latestMonth = sortedMonthKeys[sortedMonthKeys.length - 1];
    const currentMonth = monthKeyFromDate(new Date());
    const anchorMonth =
      latestMonth && latestMonth > currentMonth ? latestMonth : currentMonth;
    const anchor = dateFromMonthKey(anchorMonth);

    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(anchor.getFullYear(), anchor.getMonth() - (5 - index), 1);
      const key = monthKeyFromDate(date);
      return (
        incomeByMonth.get(key) || {
          month: key,
          sessions: 0,
          workingHours: 0,
          income: 0,
        }
      );
    });
  }, [monthlyIncomeRows]);

  const monthlyMax = Math.max(1, ...chartMonths.map((month: any) => month.income));

  const heroContent = useMemo(() => {
    const base = {
      profile: {
        stats: [
          { label: "Hồ sơ", value: `${profileCompletion}%` },
          { label: "Học phí", value: compactCurrency(hourlyRate) },
          { label: "Lịch mở", value: String(availableSchedules.length) },
        ],
        noteLabel: "Gợi ý",
        note: "Cập nhật ảnh đại diện rõ mặt giúp tăng tỷ lệ đặt lịch.",
        tag: "Tối ưu",
      },
      expertise: {
        stats: [
          { label: "Cấp độ", value: expertiseForm.skillLevel || "Chưa chọn" },
          { label: "Chứng chỉ", value: hasCertificate ? "1" : "0" },
          { label: "Kinh nghiệm", value: `${expertiseForm.experienceYears || 0} năm` },
        ],
        noteLabel: "Ưu tiên",
        note: "Thêm kỹ năng phụ để hồ sơ xuất hiện tốt hơn trong bộ lọc Coach.",
        tag: "Nên làm",
      },
      fee: {
        stats: [
          { label: "Học phí", value: compactCurrency(hourlyRate) },
          { label: "Biên độ", value: "150K-2M" },
          { label: "Dự báo", value: compactCurrency(projectedMonthlyIncome) },
        ],
        noteLabel: "Gợi ý",
        note: "Mức giá hiện tại đang phù hợp nhóm Coach chuyên nghiệp.",
        tag: "Ổn",
      },
      schedules: {
        stats: [
          { label: "Hôm nay", value: String(todayOpenCount) },
          { label: "Tuần này", value: String(availableSchedules.length) },
          { label: "Đang bận", value: String(unavailableCount) },
        ],
        noteLabel: "Khung tốt",
        note: "17:00 - 20:00 thường có nhu cầu đặt Coach cao.",
        tag: "Hot",
      },
      bookings: {
        stats: [
          { label: "Đơn gần đây", value: String(bookings.length) },
          { label: "Hoàn thành", value: String(completedBookings) },
          { label: "Đã hủy", value: String(cancelledBookings) },
        ],
        noteLabel: "Nhắc lịch",
        note: nextSchedule
          ? `Slot tiếp theo: ${toDateLabel(nextSchedule.WorkingDate)} · ${nextSchedule.StartTime} - ${nextSchedule.EndTime}.`
          : "Chưa có lịch mở sắp tới.",
        tag: nextSchedule ? "Sắp tới" : "Trống",
      },
      income: {
        stats: [
          { label: "Buổi dạy", value: String(completedSessions) },
          { label: "Tổng giờ", value: String(totalWorkingHours) },
          { label: "Thu nhập", value: compactCurrency(totalIncome) },
        ],
        noteLabel: "Thanh toán",
        note: "Theo dõi các buổi đã hoàn thành và doanh thu theo tháng.",
        tag: "Sẵn sàng",
      },
    };

    return base[activeTab] || base.profile;
  }, [
    activeTab,
    availableSchedules.length,
    bookings.length,
    cancelledBookings,
    completedBookings,
    completedSessions,
    expertiseForm.experienceYears,
    expertiseForm.skillLevel,
    hasCertificate,
    hourlyRate,
    nextSchedule,
    profileCompletion,
    projectedMonthlyIncome,
    todayOpenCount,
    totalIncome,
    totalWorkingHours,
    unavailableCount,
  ]);

  const loadProfile = useCallback(async () => {
    try {
      setProfileError("");
      const data = await getMyCoachProfile(token);
      setCoach(data);
      setProfileForm({
        experienceYears: data.ExperienceYears || 0,
        biography: data.Biography || "",
        specialization: data.Specialization || "",
      });
      setExpertiseForm({
        skillLevel: data.SkillLevel || "",
        specialization: data.Specialization || "",
        certifications: data.Certifications || "",
        experienceYears: data.ExperienceYears || 0,
      });
      setHourlyRate(data.HourlyRate || 150000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Không tải được hồ sơ");
    }
  }, [token]);

  useEffect(() => {
    let mounted = true;
    setLoadingProfile(true);
    loadProfile().finally(() => {
      if (mounted) setLoadingProfile(false);
    });
    return () => {
      mounted = false;
    };
  }, [loadProfile]);

  const loadSchedules = useCallback(async () => {
    try {
      setSchedulesLoading(true);
      const data = await getMySchedules(token);
      setSchedules(data);
    } catch {
      setSchedules([]);
    } finally {
      setSchedulesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === "schedules" || activeTab === "profile") {
      loadSchedules();
    }
  }, [activeTab, loadSchedules]);

  const schedulePageCount = Math.max(
    1,
    Math.ceil(schedules.length / SCHEDULES_PER_PAGE)
  );
  const safeSchedulePage = Math.min(schedulePage, schedulePageCount);
  const visibleSchedules = useMemo(() => {
    const startIndex = (safeSchedulePage - 1) * SCHEDULES_PER_PAGE;
    return schedules.slice(startIndex, startIndex + SCHEDULES_PER_PAGE);
  }, [schedules, safeSchedulePage]);
  const scheduleRangeStart =
    schedules.length === 0 ? 0 : (safeSchedulePage - 1) * SCHEDULES_PER_PAGE + 1;
  const scheduleRangeEnd = Math.min(
    schedules.length,
    safeSchedulePage * SCHEDULES_PER_PAGE
  );

  useEffect(() => {
    if (schedulePage > schedulePageCount) {
      setSchedulePage(schedulePageCount);
    }
  }, [schedulePage, schedulePageCount]);

  const loadScheduleOptions = useCallback(
    async (date: string) => {
      try {
        setLoadingOptions(true);
        const data = await getScheduleOptions(token, date);
        setScheduleOptions(data);
      } catch {
        setScheduleOptions({ startTimes: [], occupiedHours: [] });
      } finally {
        setLoadingOptions(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (activeTab === "schedules" && showScheduleForm) {
      loadScheduleOptions(scheduleForm.workingDate);
    }
  }, [activeTab, showScheduleForm, scheduleForm.workingDate, loadScheduleOptions]);

  const loadBookings = useCallback(async () => {
    try {
      setBookingsLoading(true);
      const data = await getMyReceivedBookings(token);
      setBookings(data);
    } catch {
      setBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === "bookings" || activeTab === "profile") {
      loadBookings();
    }
  }, [activeTab, loadBookings]);

  const loadIncome = useCallback(async () => {
    try {
      setIncomeLoading(true);
      setIncomeError("");
      const data = await getMyIncome(token);
      setIncomeData(data);
    } catch (err: any) {
      setIncomeError(err.message || "Không thể tải dữ liệu thu nhập");
    } finally {
      setIncomeLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === "income" || activeTab === "profile") {
      loadIncome();
    }
  }, [activeTab, loadIncome]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg("");

    if (profileForm.biography.length > 1000) {
      setProfileMsg("Giới thiệu tối đa 1000 ký tự.");
      return;
    }
    if (profileForm.specialization.length > 500) {
      setProfileMsg("Chuyên môn tối đa 500 ký tự.");
      return;
    }
    if (profileForm.experienceYears < 0 || profileForm.experienceYears > 50) {
      setProfileMsg("Số năm kinh nghiệm phải từ 0 đến 50.");
      return;
    }

    try {
      setProfileSaving(true);
      if (avatarFile) {
        const formData = new FormData();
        formData.append("experienceYears", String(profileForm.experienceYears));
        formData.append("biography", profileForm.biography || "");
        formData.append("specialization", profileForm.specialization || "");
        formData.append("avatar", avatarFile);

        await updateMyProfile(token, formData);
      } else {
        await updateMyProfile(token, {
          experienceYears: profileForm.experienceYears,
          biography: profileForm.biography || null,
          specialization: profileForm.specialization || null,
        });
      }
      setProfileMsg("Cập nhật hồ sơ thành công!");
      handleCancelAvatar();
      await loadProfile();
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSaveExpertise(e: React.FormEvent) {
    e.preventDefault();
    setExpertiseMsg("");

    if (!expertiseForm.skillLevel) {
      setExpertiseMsg("Vui lòng chọn trình độ kỹ năng.");
      return;
    }

    try {
      setExpertiseSaving(true);
      if (certFile) {
        const formData = new FormData();
        formData.append("skillLevel", expertiseForm.skillLevel);
        formData.append("specialization", expertiseForm.specialization || "");
        formData.append("experienceYears", String(expertiseForm.experienceYears));
        formData.append("certificate", certFile);

        await updateMyExpertise(token, formData);
      } else {
        await updateMyExpertise(token, {
          skillLevel: expertiseForm.skillLevel as any,
          specialization: expertiseForm.specialization || null,
          certifications: expertiseForm.certifications || null,
          experienceYears: expertiseForm.experienceYears,
        });
      }
      setExpertiseMsg("Cập nhật chuyên môn thành công!");
      handleCancelCert();
      await loadProfile();
    } catch (err) {
      setExpertiseMsg(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setExpertiseSaving(false);
    }
  }

  async function handleSaveFee(e: React.FormEvent) {
    e.preventDefault();
    setFeeMsg("");

    if (hourlyRate < 150000 || hourlyRate > 2000000) {
      setFeeMsg("Học phí phải từ 150.000 đ đến 2.000.000 đ.");
      return;
    }

    try {
      setFeeSaving(true);
      await updateMyTeachingFee(token, hourlyRate);
      setFeeMsg("Cập nhật học phí thành công!");
    } catch (err) {
      setFeeMsg(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setFeeSaving(false);
    }
  }

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault();
    setScheduleFormError("");

    if (scheduleForm.startTime >= scheduleForm.endTime) {
      setScheduleFormError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }

    if (scheduleForm.workingDate < todayStr()) {
      setScheduleFormError("Không thể tạo lịch dạy trong quá khứ.");
      return;
    }

    const nowVN = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
    );
    const nowTimeStr = [
      String(nowVN.getHours()).padStart(2, "0"),
      String(nowVN.getMinutes()).padStart(2, "0"),
    ].join(":");

    if (scheduleForm.workingDate === todayStr() && scheduleForm.startTime <= nowTimeStr) {
      setScheduleFormError("Giờ bắt đầu phải lớn hơn thời gian hiện tại.");
      return;
    }

    try {
      setScheduleSubmitting(true);
      await createMySchedule(token, scheduleForm);
      setShowScheduleForm(false);
      setScheduleForm({
        workingDate: todayStr(),
        startTime: "08:00",
        endTime: "09:00",
      });
      await loadSchedules();
    } catch (err) {
      setScheduleFormError(err instanceof Error ? err.message : "Tạo lịch thất bại");
    } finally {
      setScheduleSubmitting(false);
    }
  }

  function handleDeleteSchedule(scheduleId: number) {
    setConfirmConfig({
      isOpen: true,
      title: "Xác nhận xóa lịch",
      message: "Bạn có chắc muốn xóa lịch này không?",
      confirmStyle: "danger",
      onConfirm: async () => {
        try {
          setScheduleActionId(scheduleId);
          await deleteMySchedule(token, scheduleId);
          await loadSchedules();
        } catch (err) {
          alert(err instanceof Error ? err.message : "Xóa lịch thất bại");
        } finally {
          setScheduleActionId(null);
        }
      },
    });
  }

  function handleSetUnavailable(scheduleId: number) {
    setConfirmConfig({
      isOpen: true,
      title: "Xác nhận báo bận",
      message: "Bạn có chắc muốn khóa khung giờ này không?",
      confirmStyle: "warning",
      onConfirm: async () => {
        try {
          setScheduleActionId(scheduleId);
          await updateMySchedule(token, scheduleId, { status: "Unavailable" });
          await loadSchedules();
        } catch (err) {
          alert(err instanceof Error ? err.message : "Cập nhật lịch thất bại");
        } finally {
          setScheduleActionId(null);
        }
      },
    });
  }

  function handleSetAvailable(scheduleId: number) {
    setConfirmConfig({
      isOpen: true,
      title: "Xác nhận mở lại lịch",
      message: "Bạn muốn mở lại khung giờ này để học viên có thể đặt lịch?",
      confirmStyle: "success",
      onConfirm: async () => {
        try {
          setScheduleActionId(scheduleId);
          await updateMySchedule(token, scheduleId, { status: "Available" });
          await loadSchedules();
        } catch (err) {
          alert(err instanceof Error ? err.message : "Cập nhật lịch thất bại");
        } finally {
          setScheduleActionId(null);
        }
      },
    });
  }

  function handleCancelBooking(bookingId: number) {
    setConfirmConfig({
      isOpen: true,
      title: "Xác nhận hủy đơn",
      message: "Bạn có chắc muốn hủy đơn đặt lịch này? Hệ thống sẽ tự động hoàn 100% tiền cho Player.",
      onConfirm: async () => {
        try {
          setBookingActionId(bookingId);
          await cancelBookingByCoach(token, bookingId);
          alert("Hủy lịch thành công!");
          await loadBookings();
        } catch (err: any) {
          alert(err.message || "Hủy lịch thất bại");
        } finally {
          setBookingActionId(null);
        }
      },
    });
  }

  const isSuccessMessage = (message: string) => message.includes("thành công");

  if (loadingProfile) {
    return (
      <div className={styles.wrap}>
        <StateBox variant="loading" title="Đang tải hồ sơ Coach" />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className={styles.wrap}>
        <StateBox
          variant="error"
          title="Không tải được hồ sơ"
          description={profileError}
        />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.heroHeader}>
        <div className={styles.identityBlock}>
          <img
            src={getImageUrl(coach?.AvatarURL)}
            alt={coach?.FullName || "Coach"}
            className={styles.avatar}
            onError={(e) => { e.currentTarget.src = "/images/coaches/hlv1.png"; }}
          />
          <div className={styles.identityText}>
            <span className={styles.eyebrow}>Coach workspace</span>
            <h1 className={styles.name}>{coach?.FullName}</h1>
            <p className={styles.meta}>
              {Number(coach?.AverageRating || 0).toFixed(1)} điểm đánh giá ·{" "}
              {coach?.ExperienceYears || 0} năm kinh nghiệm ·{" "}
              {coach?.TotalStudents || 0} học viên
            </p>
            <div className={styles.badgeRow}>
              <span
                className={`${styles.statusBadge} ${
                  coach?.Status === "Approved" ? styles.statusActive : styles.statusPending
                }`}
              >
                {statusText}
              </span>
              <span className={styles.statusBadgeSoft}>{skillLabel}</span>
            </div>
          </div>
        </div>

        <div className={styles.heroPanel}>
          <div className={styles.heroStats}>
            {heroContent.stats.map((stat) => (
              <div key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
          <div className={styles.heroNote}>
            <strong>{heroContent.noteLabel}</strong>
            <span>{heroContent.note}</span>
            <em>{heroContent.tag}</em>
          </div>
        </div>
      </section>

      <div className={styles.content}>
        {activeTab === "profile" && (
          <form className={styles.pageCard} onSubmit={handleSaveProfile}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionKicker}>Hồ sơ công khai</span>
                <h2 className={styles.formTitle}>Thông tin hồ sơ</h2>
                <p>Cập nhật phần học viên nhìn thấy đầu tiên khi chọn Coach.</p>
              </div>
              <button type="submit" className={styles.saveBtn} disabled={profileSaving}>
                {profileSaving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>

            <div className={`${styles.contentPad}`}>
              <div className={styles.mainColumn}>
                <div className={styles.avatarUpload}>
                  <img
                    src={avatarPreview || getImageUrl(coach?.AvatarURL)}
                    alt="Avatar Preview"
                    className={styles.previewAvatar}
                    onError={(e) => { e.currentTarget.src = "/images/coaches/hlv1.png"; }}
                  />
                  <div className={styles.uploadControl}>
                    <label htmlFor="avatar">Ảnh đại diện</label>
                    <p>JPG, PNG hoặc WEBP, tối đa 3MB. Ưu tiên ảnh nền sáng, nhìn thẳng.</p>
                    <div className={styles.uploadPicker}>
                      <input
                        id="avatar"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleAvatarChange}
                        className={styles.hiddenFileInput}
                      />
                      <label htmlFor="avatar" className={styles.uploadButton}>
                        Chọn ảnh
                      </label>
                      <span className={styles.uploadFileName}>
                        {avatarFile?.name || "Chưa có tệp nào được chọn"}
                      </span>
                    </div>
                    {avatarError && <p className={styles.error}>{avatarError}</p>}
                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={handleCancelAvatar}
                        className={styles.textButton}
                      >
                        Hủy ảnh vừa chọn
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles.formColumns}>
                  <div className={styles.field}>
                    <label htmlFor="expYears">Số năm kinh nghiệm</label>
                    <input
                      id="expYears"
                      type="number"
                      min={0}
                      max={50}
                      value={profileForm.experienceYears}
                      onChange={(e) =>
                        setProfileForm((p) => ({
                          ...p,
                          experienceYears: Number(e.target.value),
                        }))
                      }
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="spec">Chuyên môn chính</label>
                    <input
                      id="spec"
                      type="text"
                      maxLength={500}
                      value={profileForm.specialization}
                      onChange={(e) =>
                        setProfileForm((p) => ({
                          ...p,
                          specialization: e.target.value,
                        }))
                      }
                      placeholder="Ví dụ: Kỹ thuật dink, phòng thủ nâng cao..."
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="bio">
                    Giới thiệu bản thân{" "}
                    <span className={styles.counter}>
                      {profileForm.biography.length}/1000
                    </span>
                  </label>
                  <textarea
                    id="bio"
                    rows={6}
                    maxLength={1000}
                    value={profileForm.biography}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        biography: e.target.value,
                      }))
                    }
                    placeholder="Chia sẻ kinh nghiệm và phong cách dạy học của bạn..."
                    className={styles.textarea}
                  />
                </div>

                {profileMsg && (
                  <p
                    className={
                      isSuccessMessage(profileMsg) ? styles.success : styles.error
                    }
                  >
                    {profileMsg}
                  </p>
                )}

                <div className={styles.kpiGrid}>
                  <div className={styles.kpiCard}>
                    <span>Tỷ lệ hoàn thiện</span>
                    <strong>{profileCompletion}%</strong>
                    <div className={styles.progressTrack}>
                      <span style={{ width: `${profileCompletion}%` }} />
                    </div>
                  </div>
                  <div className={styles.kpiCard}>
                    <span>Học viên đã dạy</span>
                    <strong>{coach?.TotalStudents || 0}</strong>
                    <p>Tổng số học viên</p>
                  </div>
                  <div className={styles.kpiCard}>
                    <span>Đánh giá trung bình</span>
                    <strong>{Number(coach?.AverageRating || 0).toFixed(1)} sao</strong>
                    <p>Từ học viên</p>
                  </div>
                </div>
              </div>


            </div>
          </form>
        )}

        {activeTab === "expertise" && (
          <form className={styles.pageCard} onSubmit={handleSaveExpertise}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionKicker}>Năng lực giảng dạy</span>
                <h2 className={styles.formTitle}>Chuyên môn & Kỹ năng</h2>
                <p>Chuẩn hóa năng lực để hệ thống gợi ý Coach chính xác hơn.</p>
              </div>
              <button type="submit" className={styles.saveBtn} disabled={expertiseSaving}>
                {expertiseSaving ? "Đang lưu..." : "Lưu chuyên môn"}
              </button>
            </div>

            <div className={`${styles.contentPad}`}>
              <div className={styles.mainColumn}>
                <section className={styles.panel}>
                  <div className={styles.panelHead}>
                    <h3>Chứng chỉ / Giải thưởng</h3>
                    <p>Ảnh chứng chỉ giúp tăng độ tin cậy.</p>
                  </div>
                  <div className={styles.panelBody}>
                    <div className={styles.certificateBox}>
                      <div className={styles.certThumb}>PPR</div>
                      <div>
                        <strong>
                          {expertiseForm.certifications && !expertiseForm.certifications.startsWith("/uploads")
                            ? expertiseForm.certifications
                            : "PPR Certified"}
                        </strong>
                        <p>{hasCertificate ? "Đã có chứng chỉ" : "Chưa tải chứng chỉ"}</p>
                      </div>
                    </div>
                    <div className={styles.uploadPicker}>
                      <input
                        id="certs"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleCertChange}
                        className={styles.hiddenFileInput}
                      />
                      <label htmlFor="certs" className={styles.uploadButton}>
                        Chọn chứng chỉ
                      </label>
                      <span className={styles.uploadFileName}>
                        {certFile?.name || "Chưa có tệp nào được chọn"}
                      </span>
                    </div>
                    {certError && <p className={styles.error}>{certError}</p>}
                    {(certPreview ||
                      (expertiseForm.certifications &&
                        expertiseForm.certifications.startsWith("/uploads"))) && (
                      <div className={styles.certificatePreview}>
                        <img
                          src={certPreview || getImageUrl(expertiseForm.certifications)}
                          alt="Certificate Preview"
                        />
                        {certPreview && (
                          <button
                            type="button"
                            onClick={handleCancelCert}
                            className={styles.textButton}
                          >
                            Hủy ảnh vừa chọn
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelHead}>
                    <h3>Trình độ kỹ năng</h3>
                    <p>Chọn cấp độ cao nhất bạn đang nhận đào tạo.</p>
                  </div>
                  <div className={styles.skillLadder}>
                    {SKILL_OPTIONS.map((option, index) => (
                      <button
                        type="button"
                        key={option.value}
                        className={`${styles.ladderStep} ${
                          expertiseForm.skillLevel === option.value ? styles.ladderStepActive : ""
                        }`}
                        onClick={() =>
                          setExpertiseForm((p) => ({
                            ...p,
                            skillLevel: option.value,
                          }))
                        }
                      >
                        <span>{index + 1}</span>
                        <div>
                          <strong>{option.label}</strong>
                          <p>
                            {option.value === "Professional"
                              ? "Nhận học viên luyện thi đấu và nâng cao hiệu suất."
                              : "Phù hợp đào tạo nền tảng, kỹ thuật và chiến thuật theo cấp độ."}
                          </p>
                        </div>
                        <em>
                          {expertiseForm.skillLevel === option.value ? "Đang chọn" : "Chọn"}
                        </em>
                      </button>
                    ))}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelHead}>
                    <h3>Chuyên môn hiển thị</h3>
                    <p>Nội dung ngắn, rõ nhóm học viên phù hợp.</p>
                  </div>
                  <div className={styles.panelBody}>
                    <div className={styles.field}>
                      <label htmlFor="spec2">Mô tả chuyên môn</label>
                      <input
                        id="spec2"
                        type="text"
                        maxLength={500}
                        value={expertiseForm.specialization}
                        onChange={(e) =>
                          setExpertiseForm((p) => ({
                            ...p,
                            specialization: e.target.value,
                          }))
                        }
                        placeholder="Ví dụ: Kỹ thuật Dink, Serve & Return..."
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.formColumns}>
                      <div className={styles.field}>
                        <label htmlFor="expYears2">Số năm kinh nghiệm</label>
                        <input
                          id="expYears2"
                          type="number"
                          min={0}
                          max={50}
                          value={expertiseForm.experienceYears}
                          onChange={(e) =>
                            setExpertiseForm((p) => ({
                              ...p,
                              experienceYears: Number(e.target.value),
                            }))
                          }
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.field}>
                        <label htmlFor="skillSelect">Trình độ hiện tại</label>
                        <select
                          id="skillSelect"
                          value={expertiseForm.skillLevel}
                          onChange={(e) =>
                            setExpertiseForm((p) => ({
                              ...p,
                              skillLevel: e.target.value,
                            }))
                          }
                          className={styles.input}
                        >
                          <option value="">Chọn trình độ</option>
                          {SKILL_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className={styles.chips}>
                      <span>Dink control</span>
                      <span>Footwork</span>
                      <span>Serve & return</span>
                      <span>Doubles strategy</span>
                      <span>Tournament prep</span>
                    </div>
                  </div>
                </section>

                {expertiseMsg && (
                  <p
                    className={
                      isSuccessMessage(expertiseMsg) ? styles.success : styles.error
                    }
                  >
                    {expertiseMsg}
                  </p>
                )}
              </div>
            </div>
          </form>
        )}

        {activeTab === "fee" && (
          <form className={styles.pageCard} onSubmit={handleSaveFee}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionKicker}>Thiết lập giá</span>
                <h2 className={styles.formTitle}>Cấu hình học phí</h2>
                <p>Điều chỉnh giá theo vị thế, tỷ lệ đặt lịch và năng lực giảng dạy.</p>
              </div>
              <button type="submit" className={styles.saveBtn} disabled={feeSaving}>
                {feeSaving ? "Đang lưu..." : "Lưu học phí"}
              </button>
            </div>

            <div className={`${styles.contentPad}`}>
              <div className={styles.mainColumn}>
                <div className={styles.priceHero}>
                  <div>
                    <span>Học phí hiện tại</span>
                    <p>Áp dụng cho mỗi giờ dạy riêng hoặc combo sân + Coach.</p>
                  </div>
                  <strong>{formatCurrency(hourlyRate)} / giờ</strong>
                </div>

                <section className={styles.panel}>
                  <div className={styles.panelHead}>
                    <h3>Điều chỉnh nhanh</h3>
                    <p>Khoảng hợp lệ: 150.000 - 2.000.000 đ mỗi giờ.</p>
                  </div>
                  <div className={styles.panelBody}>
                    <div className={styles.field}>
                      <label htmlFor="rate">Học phí (VNĐ/giờ)</label>
                      <input
                        id="rate"
                        type="number"
                        min={150000}
                        max={2000000}
                        step={10000}
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(Number(e.target.value))}
                        className={styles.input}
                      />
                    </div>
                    <input
                      type="range"
                      min={150000}
                      max={2000000}
                      step={10000}
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                      className={styles.slider}
                    />
                    <div className={styles.sliderVisual}>
                      <span style={{ width: `${feePercent}%` }} />
                    </div>
                    <div className={styles.sliderLabels}>
                      <span>150K</span>
                      <span>{compactCurrency(hourlyRate)}</span>
                      <span>2.000K</span>
                    </div>
                  </div>
                </section>

                {feeMsg && (
                  <p className={isSuccessMessage(feeMsg) ? styles.success : styles.error}>
                    {feeMsg}
                  </p>
                )}

                <div className={styles.kpiGrid}>
                  <div className={styles.kpiCard}><span>Nếu giảm 10%</span><strong>{compactCurrency(hourlyRate * 0.9)}</strong><p>Dễ tăng lịch mới</p></div>
                  <div className={styles.kpiCard}><span>Giữ hiện tại</span><strong>{compactCurrency(hourlyRate)}</strong><p>Cân bằng tốt</p></div>
                  <div className={styles.kpiCard}><span>Nếu tăng 10%</span><strong>{compactCurrency(hourlyRate * 1.1)}</strong><p>Phù hợp giờ cao điểm</p></div>
                </div>
              </div>

              </div>
          </form>
        )}

        {activeTab === "schedules" && (
          <section className={styles.pageCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionKicker}>Quản lý thời gian</span>
                <h2 className={styles.formTitle}>Lịch dạy của tôi</h2>
                <p>Tạo, khóa hoặc xóa các khung giờ nhận học viên.</p>
              </div>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => {
                  setShowScheduleForm(!showScheduleForm);
                  setScheduleFormError("");
                }}
              >
                {showScheduleForm ? "Đóng" : "Thêm lịch"}
              </button>
            </div>

            <div className={`${styles.contentPad} ${styles.scheduleLayout}`}>
              <aside className={styles.panel}>
                <div className={styles.panelHead}>
                  <h3>Tuần này</h3>
                  <p>Chọn ngày trong form thêm lịch để xem khung giờ khả dụng.</p>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.miniCalendar}>
                    {scheduleDays.map((day, index) => (
                      <div
                        className={`${styles.dayPill} ${index === 0 ? styles.dayPillActive : ""}`}
                        key={day.value}
                      >
                        <span>{day.number}</span>
                        <div>
                          <strong>{day.day}</strong>
                          <p>{day.openCount} lịch mở</p>
                        </div>
                        <em>{index === 0 ? "Hôm nay" : day.openCount}</em>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>

              <div className={styles.mainColumn}>
                {showScheduleForm && (
                  <form className={styles.scheduleForm} onSubmit={handleCreateSchedule}>
                    {scheduleFormError && <p className={styles.error}>{scheduleFormError}</p>}
                    <div className={styles.scheduleFormRow}>
                      <div className={styles.field}>
                        <label>Ngày</label>
                        <input
                          type="date"
                          value={scheduleForm.workingDate}
                          min={todayStr()}
                          onChange={(e) =>
                            setScheduleForm((p) => ({
                              ...p,
                              workingDate: e.target.value,
                              startTime: "",
                              endTime: "",
                            }))
                          }
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.field}>
                        <label>Giờ bắt đầu</label>
                        <select
                          value={scheduleForm.startTime}
                          onChange={(e) => {
                            const newStart = e.target.value;
                            setScheduleForm((p) => ({
                              ...p,
                              startTime: newStart,
                              endTime: p.endTime > newStart ? p.endTime : "",
                            }));
                          }}
                          className={styles.input}
                          required
                        >
                          <option value="">Chọn giờ</option>
                          {loadingOptions ? (
                            <option value="" disabled>Đang tải...</option>
                          ) : (
                            scheduleOptions.startTimes.map((timeStr) => (
                              <option key={timeStr} value={timeStr}>
                                {timeStr}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                      <div className={styles.field}>
                        <label>Giờ kết thúc</label>
                        <select
                          value={scheduleForm.endTime}
                          onChange={(e) =>
                            setScheduleForm((p) => ({
                              ...p,
                              endTime: e.target.value,
                            }))
                          }
                          className={styles.input}
                          disabled={!scheduleForm.startTime || loadingOptions}
                          required
                        >
                          <option value="">Chọn giờ</option>
                          {scheduleForm.startTime &&
                            !loadingOptions &&
                            (() => {
                              const startH = parseInt(scheduleForm.startTime, 10);
                              const endOptions = [];
                              let canExtend = true;

                              for (let h = startH + 1; h <= 22; h += 1) {
                                if (scheduleOptions.occupiedHours.includes(h - 1)) {
                                  canExtend = false;
                                }
                                if (!canExtend) break;

                                const timeStr = `${String(h).padStart(2, "0")}:00`;
                                endOptions.push(
                                  <option key={h} value={timeStr}>
                                    {timeStr}
                                  </option>
                                );
                              }
                              return endOptions;
                            })()}
                        </select>
                      </div>
                    </div>
                    <div className={styles.scheduleFormActions}>
                      <button
                        type="button"
                        onClick={() => setShowScheduleForm(false)}
                        className={styles.cancelBtn}
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className={styles.saveBtn}
                        disabled={
                          scheduleSubmitting ||
                          !scheduleForm.startTime ||
                          !scheduleForm.endTime
                        }
                      >
                        {scheduleSubmitting ? "Đang tạo..." : "Tạo lịch"}
                      </button>
                    </div>
                  </form>
                )}

                <div className={styles.toolbar}>
                  <div>
                    <strong>{today}</strong>
                    <p>{todayOpenCount} khung giờ có thể dạy hôm nay</p>
                  </div>
                  <div className={styles.badgeRow}>
                    <span className={styles.filterChip}>Có thể dạy</span>
                    <span className={styles.filterChip}>Bận</span>
                    <span className={styles.filterChip}>Đã đặt</span>
                  </div>
                </div>

                {schedulesLoading ? (
                  <StateBox variant="loading" title="Đang tải lịch" />
                ) : schedules.length === 0 ? (
                  <StateBox
                    variant="empty"
                    title="Chưa có lịch dạy"
                    description="Bấm Thêm lịch để tạo lịch dạy đầu tiên."
                  />
                ) : (
                  <>
                    <div className={styles.scheduleList}>
                      {visibleSchedules.map((schedule) => {
                        const isActioning = scheduleActionId === schedule.CoachScheduleID;
                        const isPast = schedule.isExpired;
                        const canAction =
                          !isPast &&
                          schedule.Status !== "Booked" &&
                          schedule.Status !== "Holding";

                        let displayStatus = STATUS_LABELS[schedule.Status] || schedule.Status;
                        let itemClass = "";

                        if (schedule.Status === "Booked") {
                          itemClass = styles.scheduleBooked;
                        } else if (isPast) {
                          itemClass = styles.scheduleUnavailable;
                          displayStatus = "Đã qua";
                        } else if (schedule.Status === "Available") {
                          itemClass = styles.scheduleAvailable;
                        } else {
                          itemClass = styles.scheduleUnavailable;
                        }

                        return (
                          <article
                            key={schedule.CoachScheduleID}
                            className={`${styles.scheduleItem} ${itemClass}`}
                          >
                            <div className={styles.scheduleDate}>
                              {toDateLabel(schedule.WorkingDate)}
                            </div>
                            <div>
                              <strong>
                                {schedule.StartTime} - {schedule.EndTime}
                              </strong>
                              <p>Slot đơn · học phí {formatCurrency(hourlyRate)}</p>
                            </div>
                            <span className={styles.scheduleStatus}>{displayStatus}</span>

                            {canAction ? (
                              <div className={styles.scheduleActions}>
                                {schedule.Status === "Available" ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSetUnavailable(schedule.CoachScheduleID)
                                    }
                                    disabled={isActioning}
                                    className={styles.btnWarning}
                                  >
                                    {isActioning ? "..." : "Bận"}
                                  </button>
                                ) : schedule.Status === "Unavailable" ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSetAvailable(schedule.CoachScheduleID)
                                    }
                                    disabled={isActioning}
                                    className={styles.btnAvailable}
                                  >
                                    {isActioning ? "..." : "Mở lại"}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteSchedule(schedule.CoachScheduleID)
                                  }
                                  disabled={isActioning}
                                  className={styles.btnDelete}
                                >
                                  {isActioning ? "..." : "Xóa"}
                                </button>
                              </div>
                            ) : (
                              <span className={styles.lockedNote}>Không thể thay đổi</span>
                            )}
                          </article>
                        );
                      })}
                    </div>

                    {schedulePageCount > 1 && (
                      <div className={styles.paginationBar}>
                        <span className={styles.paginationInfo}>
                          Hiển thị {scheduleRangeStart}-{scheduleRangeEnd} /{" "}
                          {schedules.length} lịch
                        </span>
                        <div className={styles.paginationControls}>
                          <button
                            type="button"
                            className={styles.pageBtn}
                            onClick={() =>
                              setSchedulePage((page) => Math.max(1, page - 1))
                            }
                            disabled={safeSchedulePage === 1}
                          >
                            Trước
                          </button>
                          <span className={styles.pageIndicator}>
                            Trang {safeSchedulePage} / {schedulePageCount}
                          </span>
                          <button
                            type="button"
                            className={styles.pageBtn}
                            onClick={() =>
                              setSchedulePage((page) =>
                                Math.min(schedulePageCount, page + 1)
                              )
                            }
                            disabled={safeSchedulePage === schedulePageCount}
                          >
                            Sau
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === "bookings" && (
          <section className={styles.pageCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionKicker}>Học viên</span>
                <h2 className={styles.formTitle}>Danh sách đơn đặt lịch</h2>
                <p>Theo dõi trạng thái đơn và xử lý các trường hợp cần hủy lịch.</p>
              </div>
            </div>

            <div className={styles.contentPad}>
              <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}><span>Đơn gần đây</span><strong>{bookings.length}</strong></div>
                <div className={styles.kpiCard}><span>Đã hoàn thành</span><strong>{completedBookings}</strong></div>
                <div className={styles.kpiCard}><span>Doanh thu hoàn tất</span><strong>{formatCurrency(totalIncome)}</strong></div>
              </div>

              <div className={styles.toolbar}>
                <div>
                  <strong>Tất cả đơn đặt lịch</strong>
                  <p>Sắp xếp theo lịch mới nhất.</p>
                </div>
                <div className={styles.badgeRow}>
                  <span className={styles.filterChip}>Upcoming</span>
                  <span className={styles.filterChip}>Completed</span>
                  <span className={styles.filterChip}>Cancelled</span>
                </div>
              </div>

              {bookingsLoading ? (
                <StateBox variant="loading" title="Đang tải danh sách..." />
              ) : bookings.length === 0 ? (
                <StateBox
                  variant="empty"
                  title="Chưa có đơn đặt lịch nào"
                  description="Bạn sẽ thấy danh sách học viên đặt lịch ở đây."
                />
              ) : (
                <div className={styles.bookingList}>
                  {sortedBookings.map((booking) => {
                    const bookingDateStr = booking.BookingDate.includes("T")
                      ? booking.BookingDate.split("T")[0]
                      : booking.BookingDate;
                    const sessionStartTime = new Date(
                      `${bookingDateStr}T${booking.StartTime}`
                    );
                    const isFutureSession = sessionStartTime > new Date();
                    const canCancel =
                      (booking.Status === "Confirmed" ||
                        booking.Status === "PendingPayment") &&
                      isFutureSession;
                    const isActioning = bookingActionId === booking.BookingID;
                    const statusClass =
                      booking.Status === "Completed"
                        ? styles.bookingCompleted
                        : booking.Status === "Cancelled"
                        ? styles.bookingCancelled
                        : styles.bookingUpcoming;
                    return (
                      <article
                        key={booking.BookingID}
                        className={`${styles.bookingCard} ${statusClass}`}
                      >
                        <div>
                          <strong>{toDateLabel(booking.BookingDate)}</strong>
                          <p>{booking.StartTime} - {booking.EndTime}</p>
                        </div>
                        <div>
                          <strong>{booking.BookingCode}</strong>
                          <p>
                            {booking.PlayerName || "Học viên"} ·{" "}
                            {booking.CourtName || "Không kèm sân"}
                          </p>
                        </div>
                        <span className={styles.scheduleStatus}>{booking.Status}</span>
                        <strong className={styles.amount}>
                          {formatCurrency(Number(booking.CoachFee || booking.TotalAmount || 0))}
                        </strong>
                        {canCancel ? (
                          <button
                            type="button"
                            className={styles.btnDelete}
                            onClick={() => handleCancelBooking(booking.BookingID)}
                            disabled={isActioning}
                          >
                            {isActioning ? "Đang hủy..." : "Hủy đơn"}
                          </button>
                        ) : (
                          <span className={styles.lockedNote}>Chi tiết</span>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "income" && (
          <section className={styles.pageCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionKicker}>Tài chính</span>
                <h2 className={styles.formTitle}>Thống kê & Thu nhập</h2>
                <p>Nhìn nhanh hiệu suất dạy, doanh thu theo tháng và chi tiết buổi hoàn thành.</p>
              </div>
            </div>

            <div className={styles.contentPad}>
              {incomeLoading ? (
                <StateBox variant="loading" title="Đang tải dữ liệu thu nhập..." />
              ) : incomeError ? (
                <StateBox
                  variant="error"
                  title="Lỗi tải dữ liệu"
                  description={incomeError}
                />
              ) : !incomeData ? (
                <StateBox variant="loading" title="Đang tải dữ liệu..." />
              ) : (
                <>
                  <div className={styles.incomeMetrics}>
                    <div className={styles.kpiCard}>
                      <span>Tổng buổi dạy</span>
                      <strong>{incomeData.summary.completedSessions}</strong>
                      <p>Buổi đã hoàn tất</p>
                    </div>
                    <div className={styles.kpiCard}>
                      <span>Tổng giờ dạy</span>
                      <strong>{incomeData.summary.totalWorkingHours} giờ</strong>
                      <p>Thời lượng thực dạy</p>
                    </div>
                    <div className={`${styles.kpiCard}`}>
                      <span>Tổng thu nhập</span>
                      <strong>{formatCurrency(incomeData.summary.totalIncome)}</strong>
                      <p>Đã ghi nhận từ booking hoàn thành</p>
                    </div>
                  </div>

                  <div className={styles.incomeLayout}>
                    <section className={styles.panel}>
                      <div className={styles.panelHead}>
                        <h3>Thu nhập theo tháng</h3>
                        <p>Theo dõi xu hướng 6 tháng gần nhất.</p>
                      </div>
                      <div className={styles.panelBody}>
                        <div className={styles.chart}>
                          {chartMonths.map((month: any) => {
                            const income = Number(month.income || 0);
                            const height = income > 0
                              ? Math.max(14, (income / monthlyMax) * 100)
                              : 4;

                            return (
                              <div
                                className={`${styles.bar} ${
                                  income > 0 ? styles.barActive : styles.barEmpty
                                }`}
                                key={month.month}
                                title={`${toMonthLabel(month.month)}: ${formatCurrency(income)}`}
                              >
                                <strong>{income > 0 ? compactCurrency(income) : "0"}</strong>
                                <i>
                                  <span style={{ height: `${height}%` }} />
                                </i>
                                <em>{toMonthLabel(month.month).split("/").pop()}</em>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </section>

                    <aside className={`${styles.panel}`}>
                      <div className={styles.panelHead}>
                        <h3>Tóm tắt đối soát</h3>
                        <p>Các khoản đã hoàn thành và sẵn sàng thanh toán.</p>
                      </div>
                      <div className={styles.panelBody}>
                        <div className={styles.impactRow}>
                          <span>Doanh thu hiện tại</span>
                          <strong>{formatCurrency(incomeData.summary.totalIncome)}</strong>
                        </div>
                        <div className={styles.impactRow}>
                          <span>Số booking hợp lệ</span>
                          <strong>{incomeData.summary.completedSessions}</strong>
                        </div>
                        <div className={styles.impactRow}>
                          <span>Trạng thái</span>
                          <strong>Completed</strong>
                        </div>
                      </div>
                    </aside>
                  </div>

                  <section className={styles.panel}>
                    <div className={styles.panelHead}>
                      <h3>Chi tiết buổi dạy đã hoàn thành</h3>
                      <p>Danh sách dùng để đối chiếu thu nhập.</p>
                    </div>
                    <div className={styles.panelBody}>
                      {incomeData.sessions.length > 0 ? (
                        <div className={styles.tableScroller}>
                          <table className={styles.incomeTable}>
                            <thead>
                              <tr>
                                <th>Ngày</th>
                                <th>Thời gian</th>
                                <th>Học viên</th>
                                <th>Loại</th>
                                <th>Thu nhập</th>
                                <th>Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody>
                              {incomeData.sessions.map((session: any) => (
                                <tr key={session.bookingId}>
                                  <td>{toDateLabel(session.workingDate)}</td>
                                  <td>
                                    {session.startTime} - {session.endTime} (
                                    {session.workingHours} giờ)
                                  </td>
                                  <td>{session.playerName}</td>
                                  <td>{session.bookingType}</td>
                                  <td className={styles.amount}>
                                    {formatCurrency(session.coachFee)}
                                  </td>
                                  <td>{session.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className={styles.emptyText}>Danh sách buổi dạy rỗng.</p>
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>
          </section>
        )}
      </div>

      {confirmConfig.isOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>{confirmConfig.title}</h3>
            <p>{confirmConfig.message}</p>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
              >
                Hủy
              </button>
              <button
                className={`${styles.saveBtn} ${
                  confirmConfig.confirmStyle === "danger"
                    ? styles.confirmDanger
                    : confirmConfig.confirmStyle === "warning"
                    ? styles.confirmWarning
                    : ""
                }`}
                onClick={() => {
                  confirmConfig.onConfirm();
                  setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
                }}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
