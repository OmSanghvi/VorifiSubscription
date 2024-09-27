import { SettingsCard } from "@/app/(dashboard)/settings/settings-card";
import Chat from "@/components/chat";
const SettingsPage = () => {
    return (
        <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-24">
            <SettingsCard />
            <Chat/>
        </div>
    );
}

export default SettingsPage;