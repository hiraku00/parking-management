import React from "react";

interface ContractorInfoGridProps {
  contractor: {
    name: string;
    parking_number: string;
    contract_start_year: number;
    contract_start_month: number;
    contract_end_year?: number | null;
    contract_end_month?: number | null;
  };
}

export const ContractorInfoGrid: React.FC<ContractorInfoGridProps> = ({
  contractor,
}) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-sm text-gray-500">契約者名</p>
        <p className="text-lg font-medium text-gray-900">{contractor.name}</p>
      </div>
      <div>
        <p className="text-sm text-gray-500">駐車スペース番号</p>
        <p className="text-lg font-medium text-gray-900">
          {contractor.parking_number}
        </p>
      </div>
      <div>
        <p className="text-sm text-gray-500">契約開始</p>
        <p className="text-lg font-medium text-gray-900">
          {contractor.contract_start_year}年{contractor.contract_start_month}月
        </p>
      </div>
      <div>
        <p className="text-sm text-gray-500">契約終了</p>
        <p className="text-lg font-medium text-gray-900">
          {contractor.contract_end_year && contractor.contract_end_month
            ? `${contractor.contract_end_year}年${contractor.contract_end_month}月`
            : "-"}
        </p>
      </div>
    </div>
  );
};
