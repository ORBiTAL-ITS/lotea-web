import { MasterOnlyGate } from "@/features/admin";
import { DeleteHistoryPage } from "@/features/audit/components/delete-history-page";

export default function Page() {
  return (
    <MasterOnlyGate>
      <DeleteHistoryPage />
    </MasterOnlyGate>
  );
}
