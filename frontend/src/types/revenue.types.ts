// frontend/src/types/revenue.types.ts

export type RevenueSummary = {
  totalRevenue: number;
  todayRevenue: number;
  monthRevenue: number;
  paidBookings: number;
  refundAmount: number;
  tournamentRevenue: number;
};

export type RevenueChartItem = {
  date: string;
  revenue: number;
};

export type RevenueByService = {
  serviceName: string;
  revenue: number;
};

export type RevenueServiceType =
  | "Court"
  | "Coach"
  | "Combo"
  | "Tournament";

export type RevenueFilterParams = {
  fromDate?: string;
  toDate?: string;
  serviceType?: RevenueServiceType | "";
};

export type RevenueTransaction = {
  id: string;
  customerName: string;
  serviceType: RevenueServiceType;
  amount: number;
  paymentMethod: string;
  status: "Paid" | "Refunded" | "Pending" | "Failed";
  createdAt: string;
};

export type RevenueResponse = {
  summary: RevenueSummary;
  chart: RevenueChartItem[];
  serviceRevenue: RevenueByService[];
  transactions: RevenueTransaction[];
};
