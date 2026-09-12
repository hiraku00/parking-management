export function calculateUnpaidMonths(
    contractStart: string | null,
    contractEnd: string | null,
    paidMonths: Set<string>,
    currentMonth: string = new Date().toISOString().slice(0, 7)
): string[] {
    const startMonth = contractStart || currentMonth;
    const startDate = new Date(startMonth + '-01');
    const endDate = new Date(currentMonth + '-01');

    // If contract has ended, clamp to end date
    // ensure we don't go beyond the current month even if contract end is future (though usually we bill monthly)
    // Actually, if contract ends in the past, we stop there. If it ends in future, we only calculate up to now?
    // The original logic was:
    // const actualEndDate = contractEndMonth
    //     ? new Date(Math.min(new Date(contractEndMonth + '-01').getTime(), endDate.getTime()))
    //     : endDate

    const contractEndDate = contractEnd ? new Date(contractEnd + '-01') : null;
    let actualEndDate = endDate;

    if (contractEndDate && contractEndDate.getTime() < endDate.getTime()) {
        actualEndDate = contractEndDate;
    }

    const months: string[] = [];
    // Loop from start to actual end
    for (let d = new Date(startDate); d <= actualEndDate; d.setMonth(d.getMonth() + 1)) {
        months.push(d.toISOString().slice(0, 7));
    }

    // Filter out months that are already paid
    return months.filter(m => !paidMonths.has(m));
}
