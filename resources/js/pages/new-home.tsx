import { Head, usePage, router } from '@inertiajs/react';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { motion } from 'framer-motion';

interface User {
    id: number;
    name: string;
    email: string;
    is_super_user?: boolean;
    tier?: string;
}

interface NewHomeProps {
    auth: {
        user: User;
    };
    [key: string]: unknown;
}

export default function NewHome() {
    // Always call usePage hook at the top level
    const page = usePage<NewHomeProps>();

    // Defensive auth access with error handling
    let auth;
    try {
        auth = page.props.auth;
    } catch {
        console.warn('Inertia context not available in NewHome, using fallback values');
        auth = { user: null };
    }

    const user = auth.user;

    const handleContinueToApp = () => {
        // Navigate to the current home page (field management)
        router.visit('/fields');
    };

    const handleTryBasicPlan = () => {
        // Navigate to basic plan page (mobile)
        router.visit('/free-plan');
    };

    const handleTryAdvancePlan = () => {
        // Navigate to advance plan page (desktop)
        router.visit('/fields');
    };

    const handleGoToAccount = () => {
        // Navigate to account page
        router.visit('/free-plan/account');
    };

    const handleScrollToPlans = () => {
        const plansSection = document.getElementById('plans-section');
        if (plansSection) {
            plansSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // If user is Advance tier, show a different layout
    if (user?.tier === 'advance' || user?.tier === 'advanced') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <Head title="ยินดีต้อนรับ - ระบบจัดการน้ำ" />
                <Navbar />

                {/* Advance User Hero Section */}
                <section className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 py-20">
                    <div className="mx-auto max-w-7xl px-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="text-center"
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="mb-6"
                            >
                                <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium backdrop-blur-md bg-purple-900/30 text-purple-400 border border-purple-500 shadow-lg transition-all duration-300 hover:scale-105">
                                    💎 Advance Plan
                                </span>
                            </motion.div>
                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.3 }}
                                className="mb-6 text-4xl font-bold text-white lg:text-5xl"
                            >
                                ยินดีต้อนรับกลับ, {user.name}!
                            </motion.h1>
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.4 }}
                                className="mx-auto mb-8 max-w-2xl text-lg text-slate-300"
                            >
                                คุณกำลังใช้แผน Advance ฟรีของเรา เหมาะสำหรับผู้ที่มีความรู้บ้างแล้ว
                                พร้อมที่จะดำเนินการต่อเพื่อเพิ่มประสิทธิภาพระบบชลประทานของคุณหรือไม่?
                            </motion.p>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.5 }}
                                className="flex flex-col justify-center gap-4 sm:flex-row"
                            >
                                <button
                                    onClick={handleContinueToApp}
                                    className="rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold text-white shadow-lg shadow-blue-500/50 transition-all duration-300 hover:scale-105 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/60"
                                >
                                    ไปยังแอปพลิเคชัน
                                </button>
                                <button
                                    onClick={handleGoToAccount}
                                    className="rounded-lg border-2 border-green-400 px-8 py-3 text-lg font-semibold text-green-400 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-green-400/10 hover:shadow-lg hover:shadow-green-500/30"
                                >
                                    บัญชีของฉัน
                                </button>
                            </motion.div>
                        </motion.div>
                    </div>
                </section>

                {/* App Screenshot Section */}
                <section className="bg-slate-900 py-10">
                    <div className="mx-auto max-w-7xl px-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="mb-12 text-center"
                        >
                            <h2 className="mb-4 text-3xl font-bold text-white lg:text-4xl">
                                ศูนย์จัดการการชลประทานของคุณ
                            </h2>
                            <p className="mx-auto max-w-3xl text-lg text-slate-300">
                                เข้าถึงเครื่องมือการวางแผนการชลประทานทั้งหมดของคุณและจัดการโครงการของคุณ
                                อย่างมีประสิทธิภาพ
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="relative mx-auto max-w-4xl"
                        >
                            <div className="rounded-2xl border border-slate-400/20 bg-slate-800/40 backdrop-blur-lg p-4 shadow-2xl transition-all duration-300 hover:shadow-3xl hover:shadow-slate-900/50">
                                <div className="aspect-video overflow-hidden rounded-lg">
                                    <img
                                        src="/images/app-screenshot.png"
                                        alt="อินเทอร์เฟซระบบจัดการการชลประทานอัจฉริยะ"
                                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            const fallback =
                                                target.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'flex';
                                        }}
                                    />
                                    <div
                                        className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800"
                                        style={{ display: 'none' }}
                                    >
                                        <div className="text-center">
                                            <div className="mb-4 text-6xl">🌱</div>
                                            <p className="font-medium text-slate-300">
                                                ภาพหน้าจอแอปพลิเคชัน
                                            </p>
                                            <p className="text-sm text-slate-400">
                                                อินเทอร์เฟซการวางแผนการชลประทานของคุณ
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <Head title="Welcome - Water Management System" />
            <Navbar />


            {/* Hero Section with App Screenshot */}
            <section className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 py-20">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
                        {/* Left Content */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6 }}
                            className="flex flex-col justify-center"
                        >
                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                                className="mb-6 text-4xl font-bold text-white lg:text-5xl"
                            >
                                Chaiyo Irrigation
                                <span className="block text-blue-400">Planning System</span>
                            </motion.h1>
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.3 }}
                                className="mb-8 text-lg text-slate-300"
                            >
                                ปรับปรุงการดำเนินงานทางการเกษตรของคุณด้วยแพลตฟอร์มการวางแผนและจัดการการชลประทานขั้นสูงของเรา
                                เพิ่มประสิทธิภาพการใช้น้ำ เพิ่มผลผลิตพืชผล และลดต้นทุนด้วยเทคโนโลยีที่แม่นยำ
                            </motion.p>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.4 }}
                                className="flex flex-col gap-4 sm:flex-row"
                            >
                                <button
                                    onClick={handleScrollToPlans}
                                    className="rounded-lg bg-orange-600 px-8 py-3 text-lg font-semibold text-white shadow-lg shadow-orange-500/50 transition-all duration-300 hover:scale-105 hover:bg-orange-700 hover:shadow-xl hover:shadow-orange-500/60"
                                >
                                    เริ่มใช้งาน
                                </button>
                            </motion.div>
                        </motion.div>

                        {/* Right Content - App Screenshot */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="relative"
                        >
                            <div className="rounded-2xl border border-slate-400/20 bg-slate-800/40 backdrop-blur-lg p-4 shadow-2xl transition-all duration-300 hover:shadow-3xl hover:shadow-slate-900/50">
                                <div className="aspect-video overflow-hidden rounded-lg flex items-center justify-center bg-black">
                                    <video
                                        className="h-full w-full object-cover"
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        poster="/images/app-screenshot.png"
                                    >
                                        <source src="/videos/video-test.mp4" type="video/mp4" />
                                        เบราว์เซอร์ของคุณไม่รองรับการแสดงวิดีโอ
                                    </video>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Plans Section */}
            <section id="plans-section" className="bg-slate-900 py-10">
                <div className="mx-auto max-w-7xl px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="mb-16 text-center"
                    >
                        <h2 className="mb-4 text-3xl font-bold text-white lg:text-4xl">
                            เลือกโหมดที่เหมาะกับคุณ
                        </h2>
                    </motion.div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-stretch max-w-5xl mx-auto">
                        {/* Mobile Plan */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            whileHover={{ scale: 1.02, y: -5 }}
                            className="relative flex flex-col rounded-lg border-2 border-orange-500 bg-slate-800/40 backdrop-blur-lg p-8 text-center shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/20"
                        >
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
                                <span className="whitespace-nowrap rounded-full bg-orange-500 px-3 py-1 text-xs font-medium text-white">
                                    ฟรี
                                </span>
                            </div>

                            <div className="mb-6">
                                <div className="mb-2 text-4xl">📱</div>
                                <div className="text-2xl font-bold text-white">Basic</div>
                                <div className="text-sm text-slate-400">
                                    สำหรับมือถือ
                                </div>
                            </div>

                            <div className="mb-6">
                                <div className="text-3xl font-bold text-white">ฟรี</div>
                                <div className="text-sm text-slate-400">ตลอดไป</div>
                            </div>

                            <div className="mb-8 flex-grow space-y-3 text-left">
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    เหมาะกับพื้นที่ง่ายๆ
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    การประมาณการคร่าวๆ ง่ายๆ
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    เน้นรวดเร็ว
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    ออกแบบสำหรับหน้าจอมือถือ
                                </div>
                            </div>

                            <button
                                onClick={handleTryBasicPlan}
                                className="mt-auto w-full rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white shadow-lg shadow-orange-500/50 transition-all duration-300 hover:scale-105 hover:bg-orange-700 hover:shadow-xl hover:shadow-orange-500/60"
                            >
                                เริ่มใช้ Basic
                            </button>
                        </motion.div>

                        {/* Advance Plan */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            whileHover={{ scale: 1.02, y: -5 }}
                            className="relative flex flex-col rounded-lg border-2 border-purple-500 bg-slate-800/40 backdrop-blur-lg p-8 text-center shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20"
                        >
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
                                <span className="whitespace-nowrap rounded-full bg-purple-500 px-3 py-1 text-xs font-medium text-white">
                                    ฟรี
                                </span>
                            </div>

                            <div className="mb-6">
                                <div className="mb-2 text-4xl">💻</div>
                                <div className="text-2xl font-bold text-white">Advance</div>
                                <div className="text-sm text-slate-400">สำหรับหน้าจอคอมพิวเตอร์</div>
                            </div>

                            <div className="mb-6">
                                <div className="text-3xl font-bold text-white">ฟรี</div>
                                <div className="text-sm text-slate-400">ตลอดไป</div>
                            </div>

                            <div className="mb-8 flex-grow space-y-3 text-left">
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    เหมาะสำหรับคนที่มีความรู้บ้างแล้ว
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    ฟีเจอร์ขั้นสูงและครบถ้วน
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    การวางแผนการชลประทานแบบละเอียด
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    ออกแบบสำหรับหน้าจอคอมพิวเตอร์
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    การวิเคราะห์และรายงานแบบละเอียด
                                </div>
                            </div>

                            <button
                                onClick={handleTryAdvancePlan}
                                className="mt-auto w-full rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white shadow-lg shadow-purple-500/50 transition-all duration-300 hover:scale-105 hover:bg-purple-700 hover:shadow-xl hover:shadow-purple-500/60"
                            >
                                เริ่มใช้ Advance
                            </button>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Video Section */}
            <section className="bg-slate-800/40 backdrop-blur-sm py-20">
                <div className="mx-auto max-w-7xl px-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="relative"
                    >
                        <div className="aspect-video overflow-hidden rounded-2xl shadow-2xl border border-slate-400/20 bg-slate-800/40 backdrop-blur-lg transition-all duration-300 hover:shadow-3xl hover:shadow-slate-900/50">
                            <iframe
                                className="w-full h-full"
                                width="100%"
                                height="100%"
                                src="https://www.youtube.com/embed/U_Iu9F4Nq4E?si=CEEOlOEUkssXjTC4"
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            ></iframe>
                        </div>
                    </motion.div>

                    {/* Video features */}
                    <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            whileHover={{ scale: 1.05, y: -5 }}
                            className="text-center p-6 rounded-lg bg-slate-800/40 backdrop-blur-lg border border-slate-400/20 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20"
                        >
                            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-900/30">
                                <span className="text-xl">⚡</span>
                            </div>
                            <h3 className="mb-2 text-lg font-semibold text-white">ออกแบบอย่างรวดเร็ว</h3>
                            <p className="text-sm text-slate-300">
                                สามารถออกแบบพื้นที่การปลูกสำหรับพืชและตำแหน่งต่างๆของอุแกรณ์ในสวนได้อย่างรวดเร็ว
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            whileHover={{ scale: 1.05, y: -5 }}
                            className="text-center p-6 rounded-lg bg-slate-800/40 backdrop-blur-lg border border-slate-400/20 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20"
                        >
                            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-900/30">
                                <span className="text-xl">🎯</span>
                            </div>
                            <h3 className="mb-2 text-lg font-semibold text-white">
                                การคำนวณที่แม่นยำ
                            </h3>
                            <p className="text-sm text-slate-300">
                                ระบบร์สามารถคำนวณปริมาณน้ำที่ต้องการสำหรับการปลูกพืชและการปรับปรุงการใช้น้ำให้มีประสิทธิภาพมากขึ้น
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.5 }}
                            whileHover={{ scale: 1.05, y: -5 }}
                            className="text-center p-6 rounded-lg bg-slate-800/40 backdrop-blur-lg border border-slate-400/20 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20"
                        >
                            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-900/30">
                                <span className="text-xl">📊</span>
                            </div>
                            <h3 className="mb-2 text-lg font-semibold text-white">
                                การวิเคราะห์ข้อมูล
                            </h3>
                            <p className="text-sm text-slate-300">
                                ระบบสามารถวิเคราะห์ข้อมูลสดและเชิงลึกเพื่อการปรับปรุงการใช้น้ำและการปลูกพืช และแนะนำอุปกรณ์ที่เหมาะสมสำหรับการปลูกพืช
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
