import { DataCharts } from "@/components/data-charts";
import { DataGrid } from "@/components/data-grid";
import Chat from "@/components/chat";

export default function DashboardPage() {
  return(
    <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-24 mb-0">
      <DataGrid/>
      <DataCharts/>
      <Chat/>
    </div>
  )
}
