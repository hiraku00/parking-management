import React from "react";

export type UnpaidMonth = { year: number; month: number };

export function UnpaidMonthsGrid({
  unpaidMonths,
}: {
  unpaidMonths: UnpaidMonth[];
}) {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">未払い年月</h1>
      {unpaidMonths.length === 0 ? (
        <p className="text-gray-500">未払いはありません</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {unpaidMonths.map(({ year, month }) => (
            <div
              key={`${year}-${month}`}
              className="rounded-lg border text-center py-4 px-2 text-base font-medium bg-yellow-50 border-yellow-200 text-yellow-700"
            >
              <div>
                {year}年{month}月
              </div>
              <div className="mt-1 text-sm font-bold">未払い</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
