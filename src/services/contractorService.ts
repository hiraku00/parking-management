import { supabase } from "../lib/supabase";
import { Contractor } from "../types";

export type CreateContractorInput = Omit<Contractor, "id" | "created_at">;

function isFutureOrNull(
    endYear: number | null | undefined,
    endMonth: number | null | undefined,
): boolean {
    if (endYear == null || endMonth == null) return true;
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    return endYear > nowYear || (endYear === nowYear && endMonth >= nowMonth);
}

export async function createContractor(
    input: CreateContractorInput,
): Promise<Contractor> {
    // 契約期間の整合性チェック
    if (
        input.contract_end_year != null &&
        input.contract_end_month != null &&
        (
            input.contract_start_year > input.contract_end_year ||
            (input.contract_start_year === input.contract_end_year &&
                input.contract_start_month > input.contract_end_month)
        )
    ) {
        throw new Error("契約開始年月は契約終了年月以前である必要があります");
    }

    // 既存の現役契約チェック
    const { data: existing, error: fetchError } = await supabase
        .from("contractors")
        .select("contract_end_year, contract_end_month")
        .eq("parking_number", input.parking_number);

    if (fetchError) {
        throw new Error("既存契約の確認に失敗しました");
    }
    if (
        existing &&
        existing.some((c: any) =>
            isFutureOrNull(c.contract_end_year, c.contract_end_month)
        )
    ) {
        throw new Error("この駐車スペース番号は既に現役契約が存在します");
    }

    const { data, error } = await supabase
        .from("contractors")
        .insert([input])
        .select()
        .single();

    if (error) {
        throw new Error(error.message);
    }
    return data as Contractor;
}
