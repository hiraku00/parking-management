// 契約開始・終了年月、支払い済み年月リストから未払い年月リストを返す
export function getUnpaidMonths(
    contractStartYear: number,
    contractStartMonth: number,
    contractEndYear: number | null | undefined,
    contractEndMonth: number | null | undefined,
    paidList: { year: number; month: number }[],
): { year: number; month: number }[] {
    const result: { year: number; month: number }[] = [];
    const now = new Date();
    let y = contractStartYear;
    let m = contractStartMonth;
    while (
        (contractEndYear == null || y < contractEndYear ||
            (y === contractEndYear && m <= (contractEndMonth || 12))) &&
        (y < now.getFullYear() ||
            (y === now.getFullYear() && m <= now.getMonth() + 1))
    ) {
        if (!paidList.some((p) => p.year === y && p.month === m)) {
            result.push({ year: y, month: m });
        }
        m++;
        if (m > 12) {
            m = 1;
            y++;
        }
    }
    return result;
}

import type { Contractor, Payment } from "@/types";

export function getUnpaidMonthsFromData(
    contractor: Contractor | null,
    payments: Payment[],
) {
    if (!contractor) return [];
    const paidList = payments.filter((p) => p.paid_at).map((p) => ({
        year: p.year,
        month: p.month,
    }));
    return getUnpaidMonths(
        contractor.contract_start_year,
        contractor.contract_start_month,
        contractor.contract_end_year,
        contractor.contract_end_month,
        paidList,
    );
}
