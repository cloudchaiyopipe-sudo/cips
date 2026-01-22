/* eslint-disable @typescript-eslint/no-unused-vars */
import { Head, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { 
    Smartphone, 
    Monitor, 
    CheckCircle2,
    ArrowRight,
    Leaf,
    Calculator,
    BarChart3,
    Award,
    Star,
    Package,
    Tag,
    Sparkles,
    TreeDeciduous,
    Building,
    Home,
    Settings2
} from 'lucide-react';

interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
    image_url: string;
    category: 'new' | 'promotion' | 'recommended';
    discount?: number;
    isNew?: boolean;
    isPromotion?: boolean;
    isRecommended?: boolean;
}

interface Review {
    id: number;
    name: string;
    date: string;
    rating: number;
    comment: string;
}

// Sample reviews - 15 reviews
const allReviews: Review[] = [
    { id: 1, name: 'สมชาย เกษตรกร', date: '15 มกราคม 2025', rating: 5, comment: 'ระบบใช้งานง่ายมาก แนะนำอุปกรณ์จากกนกโปรดักส์ได้ดีมาก ช่วยให้ประหยัดน้ำและเพิ่มผลผลิตได้จริง' },
    { id: 2, name: 'มาลี สวนผลไม้', date: '10 มกราคม 2025', rating: 5, comment: 'วางแผนระบบชลประทานได้แม่นยำมาก อุปกรณ์ที่แนะนำจากกนกโปรดักส์คุณภาพดี ใช้งานได้จริง' },
    { id: 3, name: 'ประเสริฐ เกษตรกรมืออาชีพ', date: '5 มกราคม 2025', rating: 4, comment: 'ระบบช่วยประหยัดน้ำได้มากจริงๆ การแนะนำอุปกรณ์จากกนกโปรดักส์ตรงกับความต้องการ' },
    { id: 4, name: 'วิไล สวนผัก', date: '28 ธันวาคม 2024', rating: 5, comment: 'ใช้ระบบนี้มาปีกว่าแล้ว ประหยัดน้ำได้มาก อุปกรณ์จากกนกโปรดักส์ทนทานมาก' },
    { id: 5, name: 'สมศักดิ์ เกษตรกร', date: '20 ธันวาคม 2024', rating: 5, comment: 'ระบบดีมาก แนะนำอุปกรณ์ได้ตรงจุด ราคาก็ดีด้วย สินค้ากนกโปรดักส์คุณภาพเยี่ยม' },
    { id: 6, name: 'นงเยาว์ สวนผลไม้', date: '15 ธันวาคม 2024', rating: 4, comment: 'ใช้งานง่าย วางแผนได้ดี อุปกรณ์ที่แนะนำใช้งานได้จริง' },
    { id: 7, name: 'วิทยา เกษตรกร', date: '10 ธันวาคม 2024', rating: 5, comment: 'ระบบนี้ช่วยให้ประหยัดเวลาและน้ำได้มาก อุปกรณ์กนกโปรดักส์ดีมาก' },
    { id: 8, name: 'รัตนา สวนผัก', date: '5 ธันวาคม 2024', rating: 5, comment: 'แนะนำมากเลย ระบบใช้งานง่าย อุปกรณ์คุณภาพดี' },
    { id: 9, name: 'สมบัติ เกษตรกร', date: '1 ธันวาคม 2024', rating: 4, comment: 'ระบบดี แนะนำอุปกรณ์ได้ดี แต่บางครั้งคำนวณอาจจะต้องปรับแต่งนิดหน่อย' },
    { id: 10, name: 'สุดา สวนผลไม้', date: '25 พฤศจิกายน 2024', rating: 5, comment: 'ใช้แล้วประหยัดน้ำได้มาก อุปกรณ์กนกโปรดักส์ทนทาน ใช้งานได้นาน' },
    { id: 11, name: 'ประยงค์ เกษตรกร', date: '20 พฤศจิกายน 2024', rating: 5, comment: 'ระบบนี้ดีมาก ช่วยวางแผนได้แม่นยำ อุปกรณ์ที่แนะนำใช้งานได้จริง' },
    { id: 12, name: 'สมหมาย สวนผัก', date: '15 พฤศจิกายน 2024', rating: 4, comment: 'ระบบใช้งานง่าย อุปกรณ์คุณภาพดี ราคาเหมาะสม' },
    { id: 13, name: 'วิมล สวนผลไม้', date: '10 พฤศจิกายน 2024', rating: 5, comment: 'แนะนำมากเลย ระบบดี อุปกรณ์กนกโปรดักส์คุณภาพเยี่ยม' },
    { id: 14, name: 'สมเกียรติ เกษตรกร', date: '5 พฤศจิกายน 2024', rating: 5, comment: 'ใช้ระบบนี้แล้วประหยัดน้ำได้มาก อุปกรณ์ทนทาน ใช้งานได้นาน' },
    { id: 15, name: 'รัชนี สวนผัก', date: '1 พฤศจิกายน 2024', rating: 4, comment: 'ระบบดี ใช้งานง่าย อุปกรณ์ที่แนะนำใช้งานได้จริง' },
];

export default function Landing() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [currentReviewIndex, setCurrentReviewIndex] = useState(0);


    // Get current 3 reviews to display
    const currentReviews = allReviews.slice(currentReviewIndex, currentReviewIndex + 3);

    // Auto rotate reviews
    useEffect(() => {
        const maxIndex = allReviews.length - 2;
        const interval = setInterval(() => {
            setCurrentReviewIndex((prev) => (prev + 1) % maxIndex);
        }, 5000); // Change every 5 seconds

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch products
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoadingProducts(true);
                // Try to fetch from public API endpoint
                const response = await fetch('/api/landing-products');
                if (response.ok) {
                    const data = await response.json();
                    setProducts(data.products || []);
                } else {
                    // Fallback: use empty array
                    setProducts([]);
                }
            } catch (error) {
                console.error('Error fetching products:', error);
                setProducts([]);
            } finally {
                setLoadingProducts(false);
            }
        };

        fetchProducts();
    }, []);

    const handleGetStarted = () => {
        router.visit('/new-home');
    };


    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <Head>
                <title>ระบบวางแผนชลประทานอัจฉริยะ - Chaiyo Irrigation Planning System | ระบบน้ำการเกษตร</title>
                <meta 
                    name="description" 
                    content="ระบบวางแผนชลประทานอัจฉริยะสำหรับการเกษตร ระบบน้ำหยด ระบบสปริงเกอร์ วางแผนการใช้น้ำ ระบบชลประทานสวนผลไม้ ระบบชลประทานบ้านสวน ระบบชลประทานโรงเรือน ระบบน้ำการเกษตรที่ทันสมัย" 
                />
                <meta 
                    name="keywords" 
                    content="ระบบชลประทาน, ระบบน้ำการเกษตร, ระบบวางแผนชลประทาน, ระบบน้ำหยด, ระบบสปริงเกอร์, ชลประทานสวนผลไม้, ชลประทานบ้านสวน, ชลประทานโรงเรือน, การวางแผนการใช้น้ำ, ระบบน้ำอัจฉริยะ, การเกษตรสมัยใหม่, ระบบชลประทานอัตโนมัติ, การจัดการน้ำ, ระบบชลประทานสำหรับเกษตรกร, ท่อชลประทาน, อุปกรณ์ชลประทาน, ระบบชลประทานราคาถูก, ระบบชลประทานคุณภาพสูง" 
                />
                <meta name="robots" content="index, follow" />
                <meta name="author" content="Chaiyo Irrigation Planning System" />
                <meta property="og:title" content="ระบบวางแผนชลประทานอัจฉริยะ - Chaiyo Irrigation Planning System" />
                <meta property="og:description" content="ระบบวางแผนชลประทานอัจฉริยะสำหรับการเกษตร ระบบน้ำหยด ระบบสปริงเกอร์ วางแผนการใช้น้ำ" />
                <meta property="og:type" content="website" />
            </Head>

            <Navbar />

            {/* Hero Section */}
            <section className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-slate-800 to-green-900 py-20 sm:py-24 lg:py-32">
                <div className="absolute inset-0 bg-[url('/images/pattern.svg')] opacity-10"></div>
                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 items-center">
                        {/* Left Content */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="text-center lg:text-left"
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="mb-6"
                            >
                                <span className="inline-flex items-center gap-2 rounded-full bg-green-500/20 px-4 py-2 text-sm font-medium text-green-400 border border-green-500/50">
                                    <Leaf className="h-4 w-4" />
                                    Chaiyo Irrigation Planning System
                                </span>
                            </motion.div>
                            
                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.3 }}
                                className="mb-6 text-4xl font-bold text-white sm:text-5xl lg:text-6xl leading-tight"
                            >
                                ออกแบบวางระบบน้ำ
                                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">
                                    โปรแกรม CIPS
                                </span>
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.4 }}
                                className="mb-8 text-lg text-slate-300 sm:text-xl max-w-2xl mx-auto lg:mx-0"
                            >
                                เพิ่มประสิทธิภาพการเกษตรของคุณด้วยระบบวางแผนชลประทานที่ทันสมัยและรวดเร็วทันใจ 
                                วางแผนการใช้น้ำอย่างแม่นยำ ลดเวลาคิดการคำนวณ เพื่อเลือกอุปกรณ์ที่สำคัญ เช่น สปริงเกอร์, มินิสปริงเกอร์, ท่อ ปั๊มน้ำ และอุปกรณ์อื่นๆ ด้วยเทคโนโลยีที่ล้ำสมัย
                            </motion.p>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.5 }}
                                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
                            >
                                <button
                                    onClick={handleGetStarted}
                                    className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-green-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/50 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/60"
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        เริ่มต้นใช้งาน
                                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                                    </span>
                                    <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-blue-600 opacity-0 transition-opacity group-hover:opacity-100"></div>
                                </button>
                            </motion.div>

                            {/* Stats */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.6 }}
                                className="mt-12 grid grid-cols-3 gap-6 sm:gap-8"
                            >
                                <div className="text-center lg:text-left">
                                    <div className="text-3xl font-bold text-green-400 sm:text-4xl">100+</div>
                                    <div className="text-sm text-slate-400 sm:text-base">ผู้ใช้งาน</div>
                                </div>
                                <div className="text-center lg:text-left">
                                    <div className="text-3xl font-bold text-blue-400 sm:text-4xl">90%</div>
                                    <div className="text-sm text-slate-400 sm:text-base">ประหยัดเวลา</div>
                                </div>
                                <div className="text-center lg:text-left">
                                    <div className="text-3xl font-bold text-purple-400 sm:text-4xl">85%</div>
                                    <div className="text-sm text-slate-400 sm:text-base">คำนวณแม่นยำ</div>
                                </div>
                            </motion.div>
                        </motion.div>

                        {/* Right Content - Image */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="relative"
                        >
                            <div className="relative rounded-2xl border border-slate-400/20 bg-slate-800/40 backdrop-blur-lg p-4 shadow-2xl">
                                <div className="aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-blue-900 to-green-900 flex items-center justify-center">
                                    <video
                                        src="/videos/video-test.mp4"
                                        className="w-full h-full object-cover rounded-lg"
                                        autoPlay
                                        muted
                                        loop
                                        playsInline
                                        controls={false}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="bg-slate-900 py-20 sm:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="mb-16 text-center"
                    >
                        <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                            ระบบชลประทานที่ครบถ้วน
                        </h2>
                        <p className="mx-auto max-w-3xl text-lg text-slate-300">
                            รองรับทุกประเภทการเกษตร ตั้งแต่สวนผลไม้ บ้านสวน ไปจนถึงโรงเรือน
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {[
                            {
                                icon: <TreeDeciduous className="h-8 w-8" />,
                                title: 'ระบบสำหรับพืชสวน(ไม้ยืนต้น)',
                                description: 'วางแผนระบบชลประทานสำหรับสวนผลไม้ทุกประเภท เหมาะสำหรับไม้ยืนต้นที่มีระยะปลูกตั้งแต่ 3x3 เมตรขึ้นไป โดยใช้ ระบบสปริงเกอร์ ระบบมินิสปริงเกอร์',
                                color: 'from-green-500 to-emerald-600'
                            },
                            {
                                icon: <Leaf className="h-8 w-8" />,
                                title: 'ระบบสำหรับพืชไร่',
                                description: 'เหมาะสำหรับพืชไร่ทุกประเภท โดยใช้ ระบบน้ำหยด ระบบสปริงเกอร์ ',
                                color: 'from-blue-500 to-cyan-600'
                            },
                            {
                                icon: <Building className="h-8 w-8" />,
                                title: 'ระบบสำหรับโรงเรือน',
                                description: 'ระบบชลประทานสำหรับโรงเรือนและเรือนกระจก โดยใช้ ระบบน้ำหยด หัวพ่นหมอก',
                                color: 'from-purple-500 to-pink-600'
                            },
                            {
                                icon: <Home className="h-8 w-8" />,
                                title: 'ระบบสำหรับสวนบ้าน(Home Garden)',
                                description: 'ระบบสำหรับสวนบ้าน โดยใช้ ระบบน้ำหยด ระบบสปริงเกอร์ ระบบมินิสปริงเกอร์ Pop-up Sprinkler',
                                color: 'from-indigo-500 to-blue-600'
                            },
                            {
                                icon: <Calculator className="h-8 w-8" />,
                                title: 'คำนวณระบบชลประทาน',
                                description: 'คำนวณระบบชลประทานตามพื้นที่ปลูก ชนิดพืช และการวางท่อและปั๊มน้ำ คำนวณความต้องการน้ำต่อวัน ต่อนาที แยกเป็นโซนและค่า TDH สำหรับเลือกซื้อปั๊มน้ำที่เหมาะสม',
                                color: 'from-orange-500 to-red-600'
                            },
                            {
                                icon: <Settings2 className="h-8 w-8" />,
                                title: 'เลือกอุปกรณ์ที่เหมาะสม',
                                description: 'นำค่าที่ได้จากการคำนวณไปใช้ในการเลือกอุปกรณ์ที่เหมาะสม เช่น สปริงเกอร์, มินิสปริงเกอร์, ท่อ ปั๊มน้ำ และอุปกรณ์อื่นๆ',
                                color: 'from-teal-500 to-green-600'
                            }
                        ].map((feature, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-slate-600 hover:shadow-xl hover:shadow-blue-500/10"
                            >
                                <div className={`mb-4 inline-flex rounded-lg bg-gradient-to-r ${feature.color} p-3 text-white`}>
                                    {feature.icon}
                                </div>
                                <h3 className="mb-3 text-xl font-semibold text-white">{feature.title}</h3>
                                <p className="text-slate-400 leading-relaxed">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="bg-slate-800/50 py-20 sm:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 items-center">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                                ประโยชน์ที่คุณจะได้รับ
                            </h2>
                            <p className="mb-8 text-lg text-slate-300">
                                ระบบวางแผนชลประทานอัจฉริยะของเราช่วยให้คุณเพิ่มประสิทธิภาพการเกษตร 
                                ลดต้นทุน และเพิ่มผลผลิตได้อย่างยั่งยืน
                            </p>
                            <div className="space-y-4">
                                {[
                                    { icon: <Monitor className="h-6 w-6" />, text: 'ผลลัพธ์จากการออกแบบวางระบบน้ำได้รวดเร็ว' },
                                    { icon: <Settings2 className="h-6 w-6" />, text: 'มีเครื่องมือช่วยออกแบบมากมาย' },
                                    { icon: <Calculator className="h-6 w-6" />, text: 'ผลลัพธ์จากการคำนวณความต้องการน้ำที่แม่นยำ' },
                                    { icon: <BarChart3 className="h-6 w-6" />, text: 'ผลลัพธ์จากการคำนวณค่า TDH หรือค่า Loss ต่างๆ' },
                                    { icon: <Package className="h-6 w-6" />, text: 'ได้อุปกรณ์ที่ที่มีขนาดเหมาะสม จากจากบริษัทกนกโปรดักส์' }
                                ].map((benefit, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5, delay: index * 0.1 }}
                                        className="flex items-center gap-4 rounded-lg bg-slate-700/50 p-4"
                                    >
                                        <div className="flex-shrink-0 rounded-lg bg-green-500/20 p-2 text-green-400">
                                            {benefit.icon}
                                        </div>
                                        <span className="text-white">{benefit.text}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="relative"
                        >
                            <div className="relative rounded-2xl border border-slate-400/20 bg-slate-800/40 backdrop-blur-lg p-4 shadow-2xl">
                                <div className="aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-green-900 to-blue-900 flex items-center justify-center">
                                    <img
                                        src="/images/image2.png"
                                        alt="กราฟและสถิติ"
                                        className="object-contain h-full max-h-72 w-auto mx-auto"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="bg-slate-900 py-20 sm:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="mb-16 text-center"
                    >
                        <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                            วิธีการใช้งาน
                        </h2>
                        <p className="mx-auto max-w-3xl text-lg text-slate-300">
                            ใช้งานง่าย เพียง 4 ขั้นตอน คุณก็สามารถวางแผนระบบชลประทานได้แล้ว
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
                        {[
                            {
                                step: '01',
                                title: 'เลือกประเภทการเกษตร',
                                description: 'เลือกประเภทการเกษตรที่ต้องการวางแผน เช่น สวนผลไม้ บ้านสวน หรือโรงเรือน'
                            },
                            {
                                step: '02',
                                title: 'กำหนดพื้นที่และพืช',
                                description: 'กำหนดพื้นที่ปลูก ชนิดพืช และข้อมูลพื้นฐานอื่นๆ ที่จำเป็นสำหรับการคำนวณ'
                            },
                            {
                                step: '03',
                                title: 'วางแผนระบบชลประทาน',
                                description: 'วางแผนตำแหน่งอุปกรณ์ ระบบน้ำหยด ระบบสปริงเกอร์ และท่อชลประทาน'
                            },
                            {
                                step: '04',
                                title: 'รับรายงานและคำแนะนำ',
                                description: 'รับรายงานการคำนวณ รายงานต้นทุน และคำแนะนำอุปกรณ์ที่เหมาะสม'
                            }
                        ].map((item, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="relative rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm"
                            >
                                <div className="mb-4 text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">
                                    {item.step}
                                </div>
                                <h3 className="mb-3 text-xl font-semibold text-white">{item.title}</h3>
                                <p className="text-slate-400 leading-relaxed">{item.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Device Support Section */}
            <section className="bg-slate-800/50 py-20 sm:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="mb-16 text-center"
                    >
                        <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                            ใช้งานได้ทุกอุปกรณ์
                        </h2>
                        <p className="mx-auto max-w-3xl text-lg text-slate-300">
                            ระบบของเรารองรับการใช้งานทั้งบนมือถือและคอมพิวเตอร์ 
                            ให้คุณวางแผนระบบชลประทานได้ทุกที่ทุกเวลา
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
                        {/* Mobile Device Image */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="flex flex-col items-center"
                        >
                            {/* Badge */}
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400 border border-blue-500/50">
                                <Smartphone className="h-4 w-4" />
                                <span>โหมด Basic</span>
                            </div>

                            {/* Image Container */}
                            <div className="relative w-full max-w-[280px] rounded-2xl border border-slate-400/20 bg-slate-800/40 backdrop-blur-lg p-2 sm:p-1 shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-blue-500/20">
                                <div className="aspect-[9/16] overflow-hidden rounded-xl bg-gradient-to-br from-blue-900 to-cyan-900 flex items-center justify-center">
                                    <img
                                        src="/images/mobile-screenshot.png"
                                        alt="หน้าจอระบบชลประทานบนมือถือ - โหมด Basic"
                                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            const fallback = target.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'flex';
                                        }}
                                    />
                                    <div
                                        className="hidden h-full w-full flex-col items-center justify-center text-center p-8"
                                        style={{ display: 'none' }}
                                    >
                                        <Smartphone className="h-24 w-24 mx-auto mb-4 text-white/50" />
                                        <p className="text-white/70 text-sm">ภาพหน้าจอมือถือ</p>
                                        <p className="text-white/50 text-xs mt-2">(คุณสามารถเพิ่มรูปภาพได้ที่นี่)</p>
                                        <p className="text-white/40 text-xs mt-1">ชื่อไฟล์: mobile-screenshot.png</p>
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mt-6 text-center max-w-md">
                                <h3 className="mb-3 text-2xl font-bold text-white">โหมด Basic - สำหรับมือถือ</h3>
                                <p className="mb-4 text-slate-300 leading-relaxed">
                                    เหมาะสำหรับการใช้งานบนมือถือ ใช้งานง่าย รวดเร็ว 
                                    เหมาะกับพื้นที่ง่ายๆ และการประมาณการคร่าวๆ
                                </p>
                                <div className="space-y-2 text-left">
                                    <div className="flex items-start gap-2 text-sm text-slate-400">
                                        <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                                        <span>ออกแบบสำหรับหน้าจอมือถือโดยเฉพาะ</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-sm text-slate-400">
                                        <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                                        <span>ใช้งานง่าย ไม่ต้องมีความรู้ทางเทคนิค</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-sm text-slate-400">
                                        <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                                        <span>เหมาะสำหรับการวางแผนพื้นที่ง่ายๆ</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-sm text-slate-400">
                                        <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                                        <span>การประมาณการที่รวดเร็วและแม่นยำ</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Desktop Device Image */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="flex flex-col items-center"
                        >
                            {/* Badge */}
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-500/20 px-4 py-2 text-sm font-medium text-purple-400 border border-purple-500/50">
                                <Monitor className="h-4 w-4" />
                                <span>โหมด Advance</span>
                            </div>

                            {/* Image Container */}
                            <div className="relative w-full rounded-2xl border border-slate-400/20 bg-slate-800/40 backdrop-blur-lg p-2 sm:p-1 shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-purple-500/20">
                                <div className="aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-purple-900 to-indigo-900 flex items-center justify-center">
                                    <img
                                        src="/images/desktop-screenshot.png"
                                        alt="หน้าจอระบบชลประทานบนคอมพิวเตอร์ - โหมด Advance"
                                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            const fallback = target.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'flex';
                                        }}
                                    />
                                    <div
                                        className="hidden h-full w-full flex-col items-center justify-center text-center p-8"
                                        style={{ display: 'none' }}
                                    >
                                        <Monitor className="h-24 w-24 mx-auto mb-4 text-white/50" />
                                        <p className="text-white/70 text-sm">ภาพหน้าจอคอมพิวเตอร์</p>
                                        <p className="text-white/50 text-xs mt-2">(คุณสามารถเพิ่มรูปภาพได้ที่นี่)</p>
                                        <p className="text-white/40 text-xs mt-1">ชื่อไฟล์: desktop-screenshot.png</p>
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mt-6 text-center max-w-md">
                                <h3 className="mb-3 text-2xl font-bold text-white">โหมด Advance - สำหรับคอมพิวเตอร์</h3>
                                <p className="mb-4 text-slate-300 leading-relaxed">
                                    เหมาะสำหรับผู้ที่มีความรู้บ้างแล้ว ฟีเจอร์ครบถ้วน 
                                    การวางแผนแบบละเอียด และการวิเคราะห์ข้อมูลเชิงลึก
                                </p>
                                <div className="space-y-2 text-left">
                                    <div className="flex items-start gap-2 text-sm text-slate-400">
                                        <CheckCircle2 className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                                        <span>ออกแบบสำหรับหน้าจอคอมพิวเตอร์ขนาดใหญ่</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-sm text-slate-400">
                                        <CheckCircle2 className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                                        <span>ฟีเจอร์ขั้นสูงและครบถ้วน</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-sm text-slate-400">
                                        <CheckCircle2 className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                                        <span>การวางแผนการชลประทานแบบละเอียด</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-sm text-slate-400">
                                        <CheckCircle2 className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                                        <span>การวิเคราะห์และรายงานแบบละเอียด</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* SEO Content Section */}
            <section className="bg-slate-900 py-20 sm:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="prose prose-invert prose-lg max-w-none">
                        <h2 className="mb-6 text-4xl text-center font-bold text-white sm:text-4xl">
                            บริษัท กนกโปรดักส์ จำกัด และ บริษัท ไชโยไปป์แอนด์ฟิตติ้ง จำกัด
                        </h2>
                        
                        <div className="space-y-6 text-slate-300 leading-relaxed">
                            <h3 className="mt-8 mb-4 text-2xl font-bold text-white">
                                เราคือใคร
                            </h3>
                            
                            <p>
                                <strong className="text-white">บริษัทกนกโปรดักส์จำกัด (Kanok Product Co., Ltd.)</strong> และ 
                                <strong className="text-white">บริษัทไชโยไปป์แอนด์ฟิตติ้งจำกัด (Chaiyo Pipe & Fitting Company Limited)</strong> 
                                เป็นพันธมิตรทางธุรกิจที่ร่วมกันพัฒนาและจำหน่ายอุปกรณ์ระบบชลประทานและอุปกรณ์ประปาการเกษตรคุณภาพสูง 
                                โดยมีประสบการณ์และความเชี่ยวชาญในการผลิตและจำหน่ายอุปกรณ์ระบบน้ำการเกษตรมายาวนาน
                            </p>

                            {/* Company and Brand Logos */}
                            <div className="my-12 flex flex-col items-center gap-8">
                                {/* Company Logo */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.6 }}
                                    className="flex flex-col items-center gap-4"
                                >
                                    <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white p-1 sm:h-40 sm:w-40 md:h-48 md:w-48">
                                        <img
                                            src="/images/kanok-chaiyo.png"
                                            alt="บริษัท กนกโปรดักส์ จำกัด และ บริษัท ไชโยไปป์แอนด์ฟิตติ้ง จำกัด"
                                            className="h-full w-full object-contain"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    <p className="text-center text-sm text-slate-400 sm:text-base">
                                        บริษัท กนกโปรดักส์ จำกัด และ บริษัท ไชโยไปป์แอนด์ฟิตติ้ง จำกัด
                                    </p>
                                </motion.div>

                                {/* Brand Logos */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.6, delay: 0.2 }}
                                    className="w-full"
                                >
                                    <h4 className="mb-6 text-center text-xl font-semibold text-white">
                                        แบรนด์ของเรา
                                    </h4>
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                                        {/* Red Hand Brand */}
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="flex h-20 w-20 items-center justify-center p-1 sm:h-24 sm:w-24 md:h-28 md:w-28"
                                                style={{
                                                    background: "rgba(255,255,255,0.92)",
                                                    borderRadius: "0.75rem",
                                                    boxShadow: "0 6px 24px 0 rgba(0,0,0,0.15)",
                                                }}
                                            >
                                                <img
                                                    src="/images/redhand-logo.png"
                                                    alt="Red Hand Logo"
                                                    className="h-full w-full object-contain"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                            <div className="text-center">
                                                <h5 className="mb-2 font-semibold text-white">Red Hand(ตรามือ)</h5>
                                                <p className="text-xs text-slate-400 sm:text-sm">
                                                    ผลิตท่อ PVC และอุปกรณ์ต่อพ่วงคุณภาพสูง ใช้ Grade A raw material 
                                                    ได้รับมาตรฐาน TIS 17-2532 มี UV protection ทนต่อแรงดัน กรด และด่าง
                                                </p>
                                            </div>
                                        </div>

                                        {/* Champ Brand */}
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="flex h-20 w-20 items-center justify-center p-1 sm:h-24 sm:w-24 md:h-28 md:w-28"
                                                style={{
                                                    background: "rgba(255,255,255,0.92)",
                                                    borderRadius: "0.75rem",
                                                    boxShadow: "0 6px 24px 0 rgba(0,0,0,0.15)",
                                                }}
                                            >
                                                <img
                                                    src="/images/champ-logo.png"
                                                    alt="Champ Logo"
                                                    className="h-full w-full object-contain"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                            <div className="text-center">
                                                <h5 className="mb-2 font-semibold text-white">ChampChaiyo(แชมป์ไชโย)</h5>
                                                <p className="text-xs text-slate-400 sm:text-sm">
                                                    แบรนด์อุปกรณ์ระบบชลประทานคุณภาพสูง สำหรับการใช้งานในสวนผลไม้ 
                                                    ระบบน้ำหยด และระบบสปริงเกอร์
                                                </p>
                                            </div>
                                        </div>

                                        {/* Chaiyo Sprinkler Brand */}
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="flex h-20 w-20 items-center justify-center p-1 sm:h-24 sm:w-24 md:h-28 md:w-28"
                                                style={{
                                                    background: "rgba(255,255,255,0.92)",
                                                    borderRadius: "0.75rem",
                                                    boxShadow: "0 6px 24px 0 rgba(0,0,0,0.15)",
                                                }}
                                            >
                                                <img
                                                    src="/images/chaiyosprinkler-logo.png"
                                                    alt="Chaiyo Sprinkler Logo"
                                                    className="h-full w-full object-contain"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                            <div className="text-center">
                                                <h5 className="mb-2 font-semibold text-white">ChaiyoSprinkler(ไชโยสปริงเกอร์)</h5>
                                                <p className="text-xs text-slate-400 sm:text-sm">
                                                    จะเน้นไปที่ระบบน้ำ ระบบหัวฉีดสปริงเกอร์ และท่อ LDPE แบบ double-layer construction 
                                                    ใช้สำหรับระบบน้ำการเกษตร และอุปกรณ์ต่อพ่วงระหว่างท่อ PVC และ PE
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>

                            <h3 className="mt-8 mb-4 text-2xl font-bold text-white">
                                ประวัติและวิสัยทัศน์
                            </h3>
                            
                            <ul className="list-disc list-inside space-y-2">
                                <li>
                                    <strong className="text-white">บริษัทกนกโปรดักส์จำกัด</strong> ก่อตั้งในปี พ.ศ. 2541 (ค.ศ. 1998) 
                                    โดยเริ่มต้นจากการผลิตหอยโข่งเท้า (foot valve) และได้ขยายธุรกิจอย่างต่อเนื่อง 
                                    จนกลายเป็นผู้นำด้านการผลิตอุปกรณ์ระบบรดน้ำและอุปกรณ์ประปาการเกษตรในประเทศไทย
                                </li>
                                <li>
                                    <strong className="text-white">บริษัทไชโยไปป์แอนด์ฟิตติ้งจำกัด</strong> ก่อตั้งในปี พ.ศ. 2551 (ค.ศ. 2008) 
                                    โดยมุ่งเน้นการผลิตและจำหน่ายท่อและอุปกรณ์ต่อพ่วงสำหรับระบบน้ำการเกษตร 
                                    ภายใต้แบรนด์ "Chaiyo" ที่เป็นที่รู้จักในตลาด
                                </li>
                                <li>
                                    วิสัยทัศน์หลักของเราคือการเป็น <strong className="text-white">"one-stop service for agricultural products and water supply systems"</strong> 
                                    โดยมุ่งเน้นการให้บริการแบบครบวงจร ตั้งแต่การออกแบบระบบ การคำนวณความต้องการน้ำ 
                                    การเลือกอุปกรณ์ที่เหมาะสม ไปจนถึงการติดตั้งและบำรุงรักษา
                                </li>
                            </ul>

                            <h3 className="mt-8 mb-4 text-2xl font-bold text-white">
                                จุดเด่นและความเชี่ยวชาญ
                            </h3>
                            
                            <ul className="list-disc list-inside space-y-2">
                                <li>
                                    <strong className="text-white">ผลิตภัณฑ์ครบวงจร:</strong> เรามีผลิตภัณฑ์มากกว่า 8,000-9,000 รายการ 
                                    ครอบคลุมอุปกรณ์ระบบชลประทานทุกประเภท ไม่ว่าจะเป็นท่อ HDPE, ท่อ PVC, ท่อ PE, 
                                    สปริงเกอร์ (Impact และแบบอื่นๆ), มินิสปริงเกอร์, อุปกรณ์น้ำหยด, วาล์ว, ฟุตวาล์ว, 
                                    hose, fittings และอุปกรณ์ต่อพ่วงต่างๆ
                                </li>
                                <li>
                                    <strong className="text-white">แบรนด์ที่หลากหลาย:</strong> เราผลิตและจำหน่ายสินค้าภายใต้แบรนด์หลัก 
                                    ได้แก่ "ไชโยสปริงเกอร์", "ตรามือ" และ "แชมป์ไชโย" ซึ่งแต่ละแบรนด์มีจุดเด่นและเหมาะกับการใช้งานที่แตกต่างกัน
                                </li>
                                <li>
                                    <strong className="text-white">มาตรฐานสากล:</strong> โรงงานของเรามีการรับรองมาตรฐาน ISO 9001:2015 
                                    และผลิตภัณฑ์หลายรายการได้รับมาตรฐาน TIS (มาตรฐานอุตสาหกรรมไทย) 
                                    ใช้กระบวนการผลิตที่ได้มาตรฐานสากล เช่น การฉีดพลาสติก (Plastic Injection Molding) 
                                    และการอัดขึ้นรูปพลาสติก PE, PVC
                                </li>
                                <li>
                                    <strong className="text-white">ประสบการณ์ยาวนาน:</strong> ด้วยประสบการณ์มากกว่า 25 ปี 
                                    เราเข้าใจความต้องการของเกษตรกรไทยและสามารถให้คำปรึกษาแนะนำอุปกรณ์ที่เหมาะสม 
                                    สำหรับการใช้งานจริงในสภาพแวดล้อมการเกษตรของประเทศไทย
                                </li>
                                <li>
                                    <strong className="text-white">การส่งออกและตลาดระหว่างประเทศ:</strong> เรามีเครือข่ายการส่งออก 
                                    ไปยังหลายประเทศในเอเชียและแอฟริกา เช่น มัลดีฟส์ ศรีลังกา ลาว เวียดนาม โอมาน มาเลเซีย 
                                    กัมพูชา เมียนมา ไนจีเรีย อินโดนีเซีย และสิงคโปร์
                                </li>
                            </ul>

                            <h3 className="mt-8 mb-4 text-2xl font-bold text-white">
                                ประกอบธุรกิจอย่างไร
                            </h3>
                            
                            <ul className="list-disc list-inside space-y-2">
                                <li>
                                    <strong className="text-white">การผลิต:</strong> เรามีโรงงานผลิตที่ทันสมัย ใช้เทคโนโลยีการผลิตพลาสติก 
                                    เช่น การฉีดพลาสติกและการอัดขึ้นรูป เพื่อผลิตอุปกรณ์ระบบชลประทานคุณภาพสูง 
                                    โดยควบคุมคุณภาพทุกขั้นตอนการผลิต
                                </li>
                                <li>
                                    <strong className="text-white">การวิจัยและพัฒนา:</strong> เรามีทีมงานวิจัยและพัฒนาที่ทำงานอย่างต่อเนื่อง 
                                    เพื่อพัฒนาผลิตภัณฑ์ใหม่ๆ ที่ตอบสนองความต้องการของเกษตรกรและผู้ใช้งานระบบชลประทาน
                                </li>
                                <li>
                                    <strong className="text-white">การจำหน่าย:</strong> เรามีเครือข่ายจำหน่ายที่ครอบคลุมทั้งในประเทศและต่างประเทศ 
                                    มีตัวแทนจำหน่ายมากกว่า 8,000 แห่งทั่วประเทศ และมีช่องทางจำหน่ายทั้งแบบ B2B และ B2C
                                </li>
                                <li>
                                    <strong className="text-white">การให้บริการ:</strong> เราให้บริการแบบครบวงจร ตั้งแต่การให้คำปรึกษา 
                                    การออกแบบระบบ การคำนวณความต้องการน้ำ การเลือกอุปกรณ์ที่เหมาะสม 
                                    ไปจนถึงการติดตั้งและบำรุงรักษาระบบชลประทาน
                                </li>
                                <li>
                                    <strong className="text-white">เทคโนโลยีดิจิทัล:</strong> เราได้พัฒนาโปรแกรม Chaiyo Irrigation Planning System (CIPS) 
                                    ซึ่งเป็นระบบวางแผนชลประทานอัจฉริยะที่ช่วยให้เกษตรกรสามารถออกแบบและวางแผนระบบชลประทานได้อย่างแม่นยำ 
                                    โดยระบบจะคำนวณความต้องการน้ำ คำนวณค่า TDH และแนะนำอุปกรณ์ที่เหมาะสมจากผลิตภัณฑ์ของเรา
                                </li>
                            </ul>

                            <h3 className="mt-8 mb-4 text-2xl font-bold text-white">
                                ทำไมต้องเลือกเรา
                            </h3>
                            
                            <ul className="list-disc list-inside space-y-2">
                                <li>
                                    <strong className="text-white">คุณภาพสูง:</strong> ทุกผลิตภัณฑ์ผ่านการตรวจสอบคุณภาพอย่างเข้มงวด 
                                    ได้รับมาตรฐาน ISO 9001:2015 และมาตรฐาน TIS
                                </li>
                                <li>
                                    <strong className="text-white">ราคายุติธรรม:</strong> เราเสนอราคาที่เป็นธรรม 
                                    โดยไม่ลดทอนคุณภาพของผลิตภัณฑ์
                                </li>
                                <li>
                                    <strong className="text-white">บริการครบวงจร:</strong> ตั้งแต่การออกแบบ การคำนวณ 
                                    การเลือกอุปกรณ์ ไปจนถึงการติดตั้งและบำรุงรักษา
                                </li>
                                <li>
                                    <strong className="text-white">ประสบการณ์ยาวนาน:</strong> มากกว่า 25 ปีในการผลิตและจำหน่าย 
                                    อุปกรณ์ระบบชลประทาน ทำให้เราเข้าใจความต้องการของเกษตรกรเป็นอย่างดี
                                </li>
                                <li>
                                    <strong className="text-white">เทคโนโลยีทันสมัย:</strong> เราใช้เทคโนโลยีการผลิตที่ทันสมัย 
                                    และพัฒนาโปรแกรมช่วยออกแบบระบบชลประทานที่ใช้งานง่ายและแม่นยำ
                                </li>
                                <li>
                                    <strong className="text-white">เครือข่ายครอบคลุม:</strong> มีตัวแทนจำหน่ายมากกว่า 8,000 แห่งทั่วประเทศ 
                                    และส่งออกไปยังหลายประเทศในเอเชียและแอฟริกา
                                </li>
                            </ul>

                            <h2 className="mt-12 mb-6 text-3xl font-bold text-white sm:text-4xl">
                                ระบบชลประทานอัจฉริยะสำหรับการเกษตรสมัยใหม่
                            </h2>
                            <ul className="list-disc list-inside space-y-2">
                                <li>
                                    <strong className="text-white">ระบบชลประทาน</strong> เป็นส่วนสำคัญของการเกษตรสมัยใหม่ 
                                    ที่ช่วยให้เกษตรกรสามารถจัดการน้ำได้อย่างมีประสิทธิภาพ 
                                    <strong className="text-white">ระบบวางแผนชลประทาน</strong>ของเราช่วยให้คุณวางแผนการใช้น้ำ 
                                    วางแผนระบบน้ำหยด ระบบสปริงเกอร์ และระบบชลประทานอื่นๆ ได้อย่างแม่นยำ
                                </li>
                                <li>
                                    <strong className="text-white">ระบบชลประทานสวนผลไม้</strong>เหมาะสำหรับสวนผลไม้ทุกประเภท 
                                    ไม่ว่าจะเป็นสวนมะม่วง สวนทุเรียน สวนเงาะ หรือสวนผลไม้อื่นๆ 
                                    ระบบของเราช่วยคำนวณปริมาณน้ำที่ต้องการ วางแผนตำแหน่งท่อชลประทาน 
                                    วางแผนตำแหน่งสปริงเกอร์ และวางแผนระบบน้ำหยดได้อย่างแม่นยำ
                                </li>
                                <li>
                                    <strong className="text-white">ระบบชลประทานบ้านสวน</strong>เหมาะสำหรับการเกษตรในบ้านสวน 
                                    ระบบน้ำหยดสำหรับพืชผัก ระบบสปริงเกอร์สำหรับสนามหญ้า 
                                    และระบบชลประทานอื่นๆ ที่ช่วยให้คุณสามารถจัดการน้ำได้อย่างมีประสิทธิภาพ
                                </li>
                                <li>
                                    <strong className="text-white">ระบบชลประทานโรงเรือน</strong>เหมาะสำหรับโรงเรือนและเรือนกระจก 
                                    ระบบน้ำหยดอัตโนมัติที่ช่วยควบคุมความชื้นและอุณหภูมิ 
                                    วางแผนการให้น้ำพืชอย่างแม่นยำ และช่วยเพิ่มผลผลิตได้อย่างยั่งยืน
                                </li>
                            </ul>

                            <h3 className="mt-8 mb-4 text-2xl font-bold text-white">
                                ระบบน้ำหยดและระบบสปริงเกอร์
                            </h3>
                            
                            <ul className="list-disc list-inside space-y-2">
                                <li>
                                    <strong className="text-white">ระบบน้ำหยด</strong>เป็นระบบชลประทานที่ประหยัดน้ำมากที่สุด 
                                    เหมาะสำหรับพืชผัก พืชผลไม้ และพืชอื่นๆ ที่ต้องการน้ำอย่างสม่ำเสมอ 
                                    ระบบของเราช่วยวางแผนตำแหน่งท่อน้ำหยด วางแผนระยะห่างระหว่างจุดหยด 
                                    และคำนวณปริมาณน้ำที่ต้องการได้อย่างแม่นยำ
                                </li>
                                <li>
                                    <strong className="text-white">ระบบสปริงเกอร์</strong>เหมาะสำหรับการให้น้ำในพื้นที่กว้าง 
                                    เช่น สนามหญ้า สวนผลไม้ และพื้นที่เกษตรกรรมขนาดใหญ่ 
                                    ระบบของเราช่วยวางแผนตำแหน่งสปริงเกอร์ วางแผนระยะห่างระหว่างสปริงเกอร์ 
                                    และคำนวณปริมาณน้ำที่ต้องการได้อย่างแม่นยำ
                                </li>
                            </ul>

                            <h3 className="mt-8 mb-4 text-2xl font-bold text-white">
                                อุปกรณ์ชลประทานและท่อชลประทาน
                            </h3>

                            <ul className="list-disc list-inside space-y-2">
                                <li>
                                    ระบบของเรารองรับอุปกรณ์ชลประทานทุกประเภท ไม่ว่าจะเป็นท่อชลประทาน ท่อ PVC 
                                    ท่อ PE สปริงเกอร์ มินิสปริงเกอร์ อุปกรณ์น้ำหยด วาล์ว และอุปกรณ์อื่นๆ 
                                    <strong className="text-white">ระบบจะช่วยคำนวณและแนะนำอุปกรณ์ที่เหมาะสมจากบริษัทกนกโปรดักส์</strong> 
                                    ซึ่งเป็นผู้นำด้านระบบน้ำการเกษตรที่มีมาตรฐาน ISO 9001:2015 และมีประสบการณ์มากกว่า 25 ปี 
                                    สินค้าทุกชิ้นผ่านการตรวจสอบคุณภาพและได้รับมาตรฐาน TIS
                                </li>
                            </ul>

                            <h3 className="mt-8 mb-4 text-2xl font-bold text-white">
                                ประโยชน์ของระบบชลประทานอัจฉริยะ
                            </h3>

                            <ul className="list-disc list-inside space-y-2 text-slate-300">
                                <li>ประหยัดน้ำได้มาก เมื่อเทียบกับการให้น้ำแบบดั้งเดิม</li>
                                <li>เพิ่มผลผลิตพืชผลได้ จากการให้น้ำที่เหมาะสม</li>
                                <li>ลดต้นทุนการผลิตได้ จากการใช้น้ำอย่างมีประสิทธิภาพ</li>
                                <li>ประหยัดเวลาในการจัดการ จากการวางแผนและควบคุม</li>
                                <li>วางแผนการใช้น้ำอย่างแม่นยำ จากการคำนวณที่ถูกต้อง</li>
                                <li>ได้มาตรฐานการเกษตรสมัยใหม่ ที่ช่วยเพิ่มความยั่งยืน</li>
                            </ul>

                            <h3 className="mt-8 mb-4 text-2xl font-bold text-white">
                                เริ่มต้นใช้งานระบบชลประทานอัจฉริยะ
                            </h3>

                            <ul className="list-disc list-inside space-y-2">
                                <li>
                                    เริ่มต้นใช้งาน<strong className="text-white">ระบบวางแผนชลประทาน</strong>ของเราวันนี้ 
                                    ระบบใช้งานง่าย ไม่ต้องมีความรู้ทางเทคนิคมากมาย 
                                    เพียงแค่กรอกข้อมูลพื้นฐาน ระบบจะช่วยคำนวณและวางแผนให้คุณอัตโนมัติ
                                </li>
                                <li>
                                    ระบบของเรามีทั้ง<strong className="text-white">โหมด Basic สำหรับมือถือ</strong> 
                                    และ<strong className="text-white">โหมด Advance สำหรับคอมพิวเตอร์</strong> 
                                    ให้คุณเลือกใช้งานตามความเหมาะสม 
                                    ทั้งสองโหมดใช้งานฟรี ไม่มีค่าใช้จ่ายแอบแฝง
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Products & Promotions Section */}
            <section className="bg-slate-800/50 py-20 sm:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="mb-12 text-center"
                    >
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-yellow-500/20 px-4 py-2 text-sm font-medium text-yellow-400 border border-yellow-500/50">
                            <Package className="h-4 w-4" />
                            <span>สินค้าจากกนกโปรดักส์</span>
                        </div>
                        <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                            สินค้าใหม่และโปรโมชั่น
                        </h2>
                    </motion.div>

                    {loadingProducts ? (
                        <div className="flex justify-center py-12">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {/* New Products */}
                            {products
                                .filter((p) => p.category === 'new' || p.isNew)
                                .slice(0, 1)
                                .map((product) => (
                                    <motion.div
                                        key={product.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5 }}
                                        className="group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm transition-all duration-300 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10"
                                    >
                                        <div className="absolute top-4 right-4 z-10 rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white">
                                            <Sparkles className="inline h-3 w-3 mr-1" />
                                            สินค้าใหม่
                                        </div>
                                        <div className="aspect-square overflow-hidden bg-gradient-to-br from-blue-900 to-cyan-900">
                                            {product.image_url ? (
                                                <img
                                                    src={product.image_url}
                                                    alt={product.name}
                                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center p-8">
                                                    <Package className="h-24 w-24 text-white/30" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-6">
                                            <h3 className="mb-2 text-xl font-semibold text-white line-clamp-2">{product.name}</h3>
                                            <p className="mb-3 text-sm text-slate-400 line-clamp-2">{product.description}</p>
                                            <div className="flex items-center gap-2">
                                                {product.originalPrice && (
                                                    <span className="text-sm text-slate-500 line-through">
                                                        ฿{product.originalPrice.toLocaleString()}
                                                    </span>
                                                )}
                                                <span className="text-lg font-bold text-green-400">
                                                    ฿{product.price.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}

                            {/* Promotions */}
                            {products
                                .filter((p) => p.category === 'promotion' || p.isPromotion)
                                .slice(0, 1)
                                .map((product) => (
                                    <motion.div
                                        key={product.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5, delay: 0.1 }}
                                        className="group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm transition-all duration-300 hover:border-orange-500 hover:shadow-xl hover:shadow-orange-500/10"
                                    >
                                        <div className="absolute top-4 right-4 z-10 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">
                                            <Tag className="inline h-3 w-3 mr-1" />
                                            โปรโมชั่น
                                        </div>
                                        {product.discount && (
                                            <div className="absolute top-4 left-4 z-10 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
                                                -{product.discount}%
                                            </div>
                                        )}
                                        <div className="aspect-square overflow-hidden bg-gradient-to-br from-orange-900 to-red-900">
                                            {product.image_url ? (
                                                <img
                                                    src={product.image_url}
                                                    alt={product.name}
                                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center p-8">
                                                    <Tag className="h-24 w-24 text-white/30" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-6">
                                            <h3 className="mb-2 text-xl font-semibold text-white line-clamp-2">{product.name}</h3>
                                            <p className="mb-3 text-sm text-slate-400 line-clamp-2">{product.description}</p>
                                            <div className="flex items-center gap-2">
                                                {product.originalPrice && (
                                                    <span className="text-sm text-slate-500 line-through">
                                                        ฿{product.originalPrice.toLocaleString()}
                                                    </span>
                                                )}
                                                <span className="text-lg font-bold text-orange-400">
                                                    ฿{product.price.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}

                            {/* Recommended Products */}
                            {products
                                .filter((p) => p.category === 'recommended' || p.isRecommended)
                                .slice(0, 1)
                                .map((product) => (
                                    <motion.div
                                        key={product.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5, delay: 0.2 }}
                                        className="group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm transition-all duration-300 hover:border-green-500 hover:shadow-xl hover:shadow-green-500/10"
                                    >
                                        <div className="absolute top-4 right-4 z-10 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white">
                                            <Award className="inline h-3 w-3 mr-1" />
                                            แนะนำ
                                        </div>
                                        <div className="aspect-square overflow-hidden bg-gradient-to-br from-green-900 to-emerald-900">
                                            {product.image_url ? (
                                                <img
                                                    src={product.image_url}
                                                    alt={product.name}
                                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center p-8">
                                                    <Award className="h-24 w-24 text-white/30" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-6">
                                            <h3 className="mb-2 text-xl font-semibold text-white line-clamp-2">{product.name}</h3>
                                            <p className="mb-3 text-sm text-slate-400 line-clamp-2">{product.description}</p>
                                            <div className="flex items-center gap-2">
                                                {product.originalPrice && (
                                                    <span className="text-sm text-slate-500 line-through">
                                                        ฿{product.originalPrice.toLocaleString()}
                                                    </span>
                                                )}
                                                <span className="text-lg font-bold text-green-400">
                                                    ฿{product.price.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}

                            {/* Fallback if no products */}
                            {products.length === 0 && (
                                <>
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5 }}
                                        className="group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm transition-all duration-300 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10"
                                    >
                                        <div className="absolute top-4 right-4 z-10 rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white">
                                            <Sparkles className="inline h-3 w-3 mr-1" />
                                            สินค้าใหม่
                                        </div>
                                        <div className="aspect-square overflow-hidden bg-gradient-to-br from-blue-900 to-cyan-900">
                                            <div className="flex h-full items-center justify-center p-8">
                                                <Package className="h-24 w-24 text-white/30" />
                                            </div>
                                        </div>
                                        <div className="p-6">
                                            <h3 className="mb-2 text-xl font-semibold text-white">สินค้าใหม่ล่าสุด</h3>
                                            <p className="text-sm text-slate-400">
                                                อุปกรณ์ชลประทานรุ่นใหม่ล่าสุดจากกนกโปรดักส์ พร้อมเทคโนโลยีที่ทันสมัย
                                            </p>
                                        </div>
                                    </motion.div>
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5, delay: 0.1 }}
                                        className="group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm transition-all duration-300 hover:border-orange-500 hover:shadow-xl hover:shadow-orange-500/10"
                                    >
                                        <div className="absolute top-4 right-4 z-10 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">
                                            <Tag className="inline h-3 w-3 mr-1" />
                                            โปรโมชั่น
                                        </div>
                                        <div className="aspect-square overflow-hidden bg-gradient-to-br from-orange-900 to-red-900">
                                            <div className="flex h-full items-center justify-center p-8">
                                                <Tag className="h-24 w-24 text-white/30" />
                                            </div>
                                        </div>
                                        <div className="p-6">
                                            <h3 className="mb-2 text-xl font-semibold text-white">โปรโมชั่นพิเศษ</h3>
                                            <p className="text-sm text-slate-400">
                                                ราคาพิเศษสำหรับสินค้าชลประทานคุณภาพสูง ลดราคาสูงสุด พร้อมส่ง
                                            </p>
                                        </div>
                                    </motion.div>
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5, delay: 0.2 }}
                                        className="group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm transition-all duration-300 hover:border-green-500 hover:shadow-xl hover:shadow-green-500/10"
                                    >
                                        <div className="absolute top-4 right-4 z-10 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white">
                                            <Award className="inline h-3 w-3 mr-1" />
                                            แนะนำ
                                        </div>
                                        <div className="aspect-square overflow-hidden bg-gradient-to-br from-green-900 to-emerald-900">
                                            <div className="flex h-full items-center justify-center p-8">
                                                <Award className="h-24 w-24 text-white/30" />
                                            </div>
                                        </div>
                                        <div className="p-6">
                                            <h3 className="mb-2 text-xl font-semibold text-white">สินค้าแนะนำ</h3>
                                            <p className="text-sm text-slate-400">
                                                อุปกรณ์ชลประทานที่แนะนำจากกนกโปรดักส์ เหมาะสำหรับการใช้งานจริง
                                            </p>
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* Reviews Section */}
            {/* <section className="bg-slate-900 py-20 sm:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="mb-12 text-center"
                    >
                        <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                            รีวิวจากผู้ใช้งาน
                        </h2>
                        <p className="mx-auto max-w-3xl text-lg text-slate-300">
                            ความคิดเห็นจากผู้ใช้งานจริงที่ได้ใช้ระบบวางแผนชลประทานของเรา
                        </p>
                    </motion.div>

                    <div className="relative">

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                            <AnimatePresence mode="wait">
                                {currentReviews.map((review) => (
                                    <motion.div
                                        key={review.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.3 }}
                                        className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm"
                                    >
                                        <div className="mb-4 flex items-center gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    className={`h-5 w-5 ${
                                                        star <= review.rating
                                                            ? 'fill-yellow-400 text-yellow-400'
                                                            : 'text-slate-600'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                        <p className="mb-4 text-slate-300 leading-relaxed">
                                            "{review.comment}"
                                        </p>
                                        <div className="flex items-center justify-between border-t border-slate-700 pt-4">
                                            <div>
                                                <p className="font-semibold text-white">{review.name}</p>
                                                <p className="text-xs text-slate-400">{review.date}</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>

                </div>
            </section>
 */}

            {/* CTA Section */}
            <section className="bg-gradient-to-r from-blue-600 to-green-600 py-20 sm:py-24">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                            พร้อมเริ่มต้นใช้งานแล้วหรือยัง?
                        </h2>
                        <p className="mb-8 text-xl text-white/90">
                            เริ่มต้นวางแผนระบบชลประทานของคุณวันนี้ ใช้งานฟรี ไม่มีค่าใช้จ่ายใดๆ
                        </p>
                        <button
                            onClick={handleGetStarted}
                            className="group relative overflow-hidden rounded-lg bg-white px-10 py-5 text-lg font-semibold text-blue-600 shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                เริ่มต้นใช้งานทันที!!
                                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-green-50 opacity-0 transition-opacity group-hover:opacity-100"></div>
                        </button>
                    </motion.div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
