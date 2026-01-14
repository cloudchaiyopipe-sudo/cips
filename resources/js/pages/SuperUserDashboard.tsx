/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { useLanguage } from '../contexts/LanguageContext';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import PaymentReviewModal from '../components/PaymentReviewModal';
import PaymentEditModal from '../components/PaymentEditModal';
import HorticultureMapPreview from '../components/horticulture/HorticultureMapPreview';
import {
    FaUsers,
    FaFolder,
    FaFolderOpen,
    FaMap,
    FaPlus,
    FaEdit,
    FaTrash,
    FaEye,
    FaChartBar,
    FaCreditCard,
    FaCheck,
    FaTimes,
    FaEnvelope,
    FaPhone,
    FaCalendarAlt,
    FaUserShield,
    FaUserTie,
    FaUser,
} from 'react-icons/fa';

// Types
type User = {
    id: number;
    name: string;
    email: string;
    phone: string;
    additional_details: string;
    is_super_user: boolean;
    role: 'user' | 'sales' | 'super_user';
    created_at: string;
    fields_count?: number;
    folders_count?: number;
};

type Field = {
    id: string;
    name: string;
    user: User;
    totalArea: number;
    totalPlants: number;
    status: string;
    isCompleted: boolean;
    created_at: string;
    category?: string;
    folderId?: string | null;
    total_water_need?: number;
    plantType?: {
        id: number;
        name: string;
        type: string;
        plant_spacing: number;
        row_spacing: number;
        water_needed: number;
    };
    project_data?: any;
    projectData?: any;
    project_stats?: any;
    garden_data?: any;
    garden_stats?: any;
    greenhouse_data?: any;
    field_crop_data?: any;
    createdAt?: string;
    area?: Array<{ lat: number; lng: number }>;
};

type Folder = {
    id: string;
    name: string;
    type: string;
    user: User;
    parent_id?: string;
    color?: string;
    icon?: string;
    created_at: string;
};

type Payment = {
    id: number;
    user_id: number;
    plan_type: string;
    months: number;
    amount: number;
    currency: string;
    tokens_purchased: number;
    status: 'pending' | 'approved' | 'rejected';
    payment_proof?: string;
    notes?: string;
    admin_notes?: string;
    approved_by?: number;
    approved_at?: string;
    created_at: string;
    updated_at: string;
    user: User;
    approver?: User;
};

type DashboardStats = {
    total_users: number;
    total_fields: number;
    total_folders: number;
    recent_users: User[];
    recent_fields: Field[];
    recent_folders: Folder[];
};

export default function SuperUserDashboard() {
    const { t } = useLanguage();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [fields, setFields] = useState<Field[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'payments'>(
        'users'
    );
    const [activePaymentTab, setActivePaymentTab] = useState<'management' | 'history'>(
        'management'
    );
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showPaymentEditModal, setShowPaymentEditModal] = useState(false);
    const [showViewProjectsModal, setShowViewProjectsModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [userFolders, setUserFolders] = useState<Folder[]>([]);
    const [userFields, setUserFields] = useState<Field[]>([]);
    const [loadingUserProjects, setLoadingUserProjects] = useState(false);
    const [userViewMode, setUserViewMode] = useState<'grid' | 'table'>('grid');
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'super_user' | 'sales' | 'user'>(
        'all'
    );
    const [userSortOption, setUserSortOption] = useState<'default' | 'newest' | 'oldest' | 'name_asc' | 'name_desc'>(
        'default'
    );
    const [currentUserPage, setCurrentUserPage] = useState(1);
    const usersPerPage = 12;

    // Project management states
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [fieldToRename, setFieldToRename] = useState<Field | null>(null);
    const [showFolderSelectionModal, setShowFolderSelectionModal] = useState(false);
    const [folderSelectionAction, setFolderSelectionAction] = useState<'move' | 'copy'>('move');
    const [fieldToMoveOrCopy, setFieldToMoveOrCopy] = useState<Field | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [fieldToShare, setFieldToShare] = useState<Field | null>(null);
    const [selectedUserForShare, setSelectedUserForShare] = useState<any>(null);
    const [userFoldersForShare, setUserFoldersForShare] = useState<Folder[]>([]);
    const [showUserFolderSelectionModal, setShowUserFolderSelectionModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [fieldToDelete, setFieldToDelete] = useState<Field | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            const [
                statsResponse,
                usersResponse,
                fieldsResponse,
                foldersResponse,
                paymentsResponse,
            ] = await Promise.allSettled([
                axios.get('/super/dashboard'),
                axios.get('/super/users'),
                axios.get('/super/fields'),
                axios.get('/super/folders'),
                axios.get('/api/admin/payments/all'),
            ]);

            // Handle stats response
            if (statsResponse.status === 'fulfilled' && statsResponse.value.data.success) {
                setStats(statsResponse.value.data.stats);
            }
            
            // Handle users response with better error handling
            if (usersResponse.status === 'fulfilled' && usersResponse.value.data) {
                if (usersResponse.value.data.success) {
                    const usersData = usersResponse.value.data.users || [];
                    setUsers(usersData);
                } else {
                    // Try to set users anyway if data exists
                    if (usersResponse.value.data?.users) {
                        setUsers(usersResponse.value.data.users);
                    }
                }
            }
            
            // Handle fields response
            if (fieldsResponse.status === 'fulfilled' && fieldsResponse.value.data.success) {
                setFields(fieldsResponse.value.data.fields);
            }
            
            // Handle folders response
            if (foldersResponse.status === 'fulfilled' && foldersResponse.value.data.success) {
                setFolders(foldersResponse.value.data.folders);
            }
            
            // Handle payments response (optional, don't crash if it fails)
            if (paymentsResponse.status === 'fulfilled' && paymentsResponse.value.data.success) {
                setPayments(paymentsResponse.value.data.payments.data || paymentsResponse.value.data.payments);
            } else if (paymentsResponse.status === 'rejected') {
                // Silently fail for payments - it's not critical for the dashboard
                console.warn('Failed to load payments:', paymentsResponse.reason?.message || 'Unknown error');
            }
        } catch (error: any) {
            console.error('Error loading dashboard data:', error);
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
            });
            
            // Try to load users separately if main request fails
            try {
                const usersResponse = await axios.get('/super/users');
                if (usersResponse.data?.success && usersResponse.data?.users) {
                    setUsers(usersResponse.data.users);
                }
            } catch (usersError) {
                console.error('Failed to load users separately:', usersError);
            }
        } finally {
            setLoading(false);
        }
    };

    // Project management handlers
    const handleRenameProject = (field: Field) => {
        setFieldToRename(field);
        setShowRenameModal(true);
    };

    const handleSubmitRename = async (newName: string) => {
        if (!fieldToRename) return;
        
        try {
            const response = await axios.put(`/api/fields/${fieldToRename.id}/name`, {
                name: newName,
            });
            
            if (response.data.success) {
                // Update field in userFields if it exists
                setUserFields(prev => prev.map(f => 
                    f.id === fieldToRename.id ? { ...f, name: newName } : f
                ));
                alert(t('rename_project_success'));
            }
        } catch (error: any) {
            console.error('Error renaming project:', error);
            alert(`Error renaming project: ${error.response?.data?.message || error.message}`);
        } finally {
            setShowRenameModal(false);
            setFieldToRename(null);
        }
    };

    const handleMoveProject = (field: Field) => {
        setFieldToMoveOrCopy(field);
        setFolderSelectionAction('move');
        setShowFolderSelectionModal(true);
    };

    const handleCopyProject = (field: Field) => {
        setFieldToMoveOrCopy(field);
        setFolderSelectionAction('copy');
        setShowFolderSelectionModal(true);
    };

    const handleShareProject = (field: Field) => {
        setFieldToShare(field);
        setShowShareModal(true);
    };

    const handleDeleteField = (field: Field) => {
        setFieldToDelete(field);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!fieldToDelete) return;
        
        setDeleting(true);
        try {
            const response = await axios.delete(`/api/fields/${fieldToDelete.id}`);
            if (response.data.success) {
                // Remove field from userFields
                setUserFields(prev => prev.filter(f => f.id !== fieldToDelete.id));
                alert(t('delete_project_success') || 'ลบโครงการสำเร็จ');
            }
        } catch (error: any) {
            console.error('Error deleting field:', error);
            alert(`${t('error_deleting_field')}: ${error.response?.data?.message || error.message}`);
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
            setFieldToDelete(null);
        }
    };

    const cancelDelete = () => {
        setShowDeleteConfirm(false);
        setFieldToDelete(null);
    };

    const handleCreateUser = async (
        userData: Omit<User, 'id' | 'created_at' | 'phone' | 'additional_details'> & {
            password: string;
        }
    ) => {
        try {
            const response = await axios.post('/super/users', userData);
            if (response.data.success) {
                setUsers((prev) => [...prev, response.data.user]);
                setShowCreateUserModal(false);
            }
        } catch (error) {
            console.error('Error creating user:', error);
            alert(t('error_creating_user'));
        }
    };

    const handleUpdateUser = async (userId: number, userData: Partial<User>) => {
        try {
            const response = await axios.put(`/super/users/${userId}`, userData);
            if (response.data.success) {
                setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...userData } : u)));
                setShowEditUserModal(false);
                setSelectedUser(null);
            }
        } catch (error) {
            console.error('Error updating user:', error);
            alert(t('error_updating_user'));
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (
            !confirm(t('delete_user_confirm'))
        ) {
            return;
        }

        try {
            const response = await axios.delete(`/super/users/${userId}`);
            if (response.data.success) {
                setUsers((prev) => prev.filter((u) => u.id !== userId));
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert(t('error_deleting_user'));
        }
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!confirm(t('delete_folder_confirm'))) {
            return;
        }

        try {
            const response = await axios.delete(`/super/folders/${folderId}`);
            if (response.data.success) {
                setFolders((prev) => prev.filter((f) => f.id !== folderId));
            }
        } catch (error) {
            console.error('Error deleting folder:', error);
            alert(t('error_deleting_folder'));
        }
    };

    const handleCreateFolder = async (
        folderData: Omit<Folder, 'id' | 'created_at' | 'user'> & { user_id: number }
    ) => {
        try {
            const response = await axios.post('/super/folders', folderData);
            if (response.data.success) {
                // Reload folders to get the new folder with user data
                const foldersResponse = await axios.get('/super/folders');
                if (foldersResponse.data.success) {
                    setFolders(foldersResponse.data.folders);
                }
                setShowCreateFolderModal(false);
            }
        } catch (error) {
            console.error('Error creating folder:', error);
            alert(t('error_creating_folder'));
        }
    };

    const handleApprovePayment = async (paymentId: number, adminNotes?: string) => {
        try {
            const response = await axios.post(`/api/admin/payments/${paymentId}/approve`, {
                admin_notes: adminNotes,
            });
            if (response.data.success) {
                // Reload payments
                const paymentsResponse = await axios.get('/api/admin/payments/all');
                if (paymentsResponse.data.success) {
                    setPayments(
                        paymentsResponse.data.payments.data || paymentsResponse.data.payments
                    );
                }
                setShowPaymentModal(false);
                setSelectedPayment(null);
                alert(t('payment_approved_success'));
            }
        } catch (error) {
            console.error('Error approving payment:', error);
            alert(t('error_approving_payment'));
        }
    };

    const handleRejectPayment = async (paymentId: number, adminNotes: string) => {
        try {
            console.log('Rejecting payment:', { paymentId, adminNotes });

            const response = await axios.post(`/api/admin/payments/${paymentId}/reject`, {
                admin_notes: adminNotes,
            });

            console.log('Reject payment response:', response.data);

            if (response.data.success) {
                // Reload payments
                const paymentsResponse = await axios.get('/api/admin/payments/all');
                if (paymentsResponse.data.success) {
                    setPayments(
                        paymentsResponse.data.payments.data || paymentsResponse.data.payments
                    );
                }
                setShowPaymentModal(false);
                setSelectedPayment(null);
                alert('Payment rejected successfully');
            } else {
                alert(response.data.message || 'Error rejecting payment');
            }
        } catch (error: any) {
            console.error('Error rejecting payment:', error);
            console.error('Error response:', error.response?.data);
            console.error('Error status:', error.response?.status);

            const errorMessage =
                error.response?.data?.message || 'Error rejecting payment. Please try again.';
            alert(errorMessage);
        }
    };

    const handleUpdatePayment = async (
        paymentId: number,
        updateData: {
            status: string;
            admin_notes?: string;
            force_remove_tokens?: boolean;
        }
    ) => {
        try {
            console.log('Updating payment:', { paymentId, updateData });

            const response = await axios.put(`/api/admin/payments/${paymentId}`, updateData);

            console.log('Update payment response:', response.data);

            if (response.data.success) {
                // Reload payments
                const paymentsResponse = await axios.get('/api/admin/payments/all');
                if (paymentsResponse.data.success) {
                    setPayments(
                        paymentsResponse.data.payments.data || paymentsResponse.data.payments
                    );
                }
                setShowPaymentEditModal(false);
                setSelectedPayment(null);
                alert(t('payment_updated_success'));
            } else {
                alert(response.data.message || t('error_updating_payment'));
            }
        } catch (error: any) {
            console.error('Error updating payment:', error);
            console.error('Error response:', error.response?.data);
            console.error('Error status:', error.response?.status);

            const errorMessage =
                error.response?.data?.message || t('error_updating_payment');
            alert(errorMessage);
        }
    };

    // Filter and sort users
    const filteredAndSortedUsers = users
        .filter((user) => {
            // Search filter
            if (userSearchTerm) {
                const searchLower = userSearchTerm.toLowerCase();
                const matchesSearch =
                    user.name.toLowerCase().includes(searchLower) ||
                    user.email.toLowerCase().includes(searchLower) ||
                    (user.phone && user.phone.includes(searchLower));
                if (!matchesSearch) return false;
            }

            // Role filter
            if (userRoleFilter !== 'all') {
                if (userRoleFilter === 'super_user' && user.role !== 'super_user') return false;
                if (userRoleFilter === 'sales' && user.role !== 'sales') return false;
                if (userRoleFilter === 'user' && user.role !== 'user') return false;
            }

            return true;
        })
        .sort((a, b) => {
            switch (userSortOption) {
                case 'default': {
                    // Sort by role priority: super_user -> sales -> user
                    const rolePriority = { super_user: 0, sales: 1, user: 2 };
                    const aPriority = rolePriority[a.role as keyof typeof rolePriority] ?? 3;
                    const bPriority = rolePriority[b.role as keyof typeof rolePriority] ?? 3;

                    if (aPriority !== bPriority) {
                        return aPriority - bPriority;
                    }

                    // Then sort by name
                    return a.name.localeCompare(b.name, 'th', { sensitivity: 'base' });
                }
                case 'newest':
                    // Sort by created_at descending (newest first)
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'oldest':
                    // Sort by created_at ascending (oldest first)
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'name_asc':
                    // Sort by name A-Z (ก-ฮ)
                    return a.name.localeCompare(b.name, 'th', { sensitivity: 'base' });
                case 'name_desc':
                    // Sort by name Z-A (ฮ-ก)
                    return b.name.localeCompare(a.name, 'th', { sensitivity: 'base' });
                default:
                    return 0;
            }
        });

    // Pagination logic
    const totalUsers = filteredAndSortedUsers.length;
    const totalPages = Math.ceil(totalUsers / usersPerPage);
    const startIndex = (currentUserPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const paginatedUsers = filteredAndSortedUsers.slice(startIndex, endIndex);

    // Reset to first page when search term, role filter, or sort option changes
    useEffect(() => {
        setCurrentUserPage(1);
    }, [userSearchTerm, userRoleFilter, userSortOption]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-900">
                <div className="text-xl text-white">{t('loading')}</div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-gray-900">
            <Navbar />
            <div className="flex-1 pt-20">
                <div className="p-6">
                    <div className="mx-auto max-w-7xl">
                        {/* Header */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-white">
                                {t('super_user_dashboard')}
                            </h1>
                            <p className="mt-2 text-gray-400">{t('manage_all_users_and_data')}</p>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="mb-6">
                            <nav className="flex space-x-8">
                                {[
                                    { id: 'users', label: t('users'), icon: FaUsers },
                                    { id: 'payments', label: t('payments'), icon: FaCreditCard },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                                            activeTab === tab.id
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                        }`}
                                    >
                                        <tab.icon className="h-4 w-4" />
                                        {tab.label}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* Content */}
                        {activeTab === 'payments' && (
                            <div>
                                <div className="mb-6">
                                    <h2 className="text-xl font-semibold text-white">
                                        {t('payment_dashboard')}
                                    </h2>
                                </div>

                                {/* Payment Stats */}
                                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                                    <div className="rounded-lg bg-yellow-600 p-4 text-white">
                                        <div className="flex items-center">
                                            <FaCreditCard className="h-6 w-6" />
                                            <div className="ml-3">
                                                <p className="text-sm opacity-90">
                                                    {t('pending_payments')}
                                                </p>
                                                <p className="text-xl font-bold">
                                                    {
                                                        payments.filter(
                                                            (p) => p.status === 'pending'
                                                        ).length
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-green-600 p-4 text-white">
                                        <div className="flex items-center">
                                            <FaCheck className="h-6 w-6" />
                                            <div className="ml-3">
                                                <p className="text-sm opacity-90">{t('approved')}</p>
                                                <p className="text-xl font-bold">
                                                    {
                                                        payments.filter(
                                                            (p) => p.status === 'approved'
                                                        ).length
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-red-600 p-4 text-white">
                                        <div className="flex items-center">
                                            <FaTimes className="h-6 w-6" />
                                            <div className="ml-3">
                                                <p className="text-sm opacity-90">{t('rejected')}</p>
                                                <p className="text-xl font-bold">
                                                    {
                                                        payments.filter(
                                                            (p) => p.status === 'rejected'
                                                        ).length
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-blue-600 p-4 text-white">
                                        <div className="flex items-center">
                                            <FaChartBar className="h-6 w-6" />
                                            <div className="ml-3">
                                                <p className="text-sm opacity-90">{t('total_revenue')}</p>
                                                <p className="text-xl font-bold">
                                                    ฿
                                                    {payments
                                                        .filter((p) => p.status === 'approved')
                                                        .reduce((sum, p) => sum + p.amount, 0)
                                                        .toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Sub-tabs */}
                                <div className="mb-6">
                                    <nav className="flex space-x-8">
                                        {[
                                            {
                                                id: 'management',
                                                label: t('payment_management'),
                                                icon: FaCreditCard,
                                            },
                                            {
                                                id: 'history',
                                                label: t('payment_history'),
                                                icon: FaChartBar,
                                            },
                                        ].map((tab) => (
                                            <button
                                                key={tab.id}
                                                onClick={() =>
                                                    setActivePaymentTab(
                                                        tab.id as 'management' | 'history'
                                                    )
                                                }
                                                className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                                                    activePaymentTab === tab.id
                                                        ? 'bg-blue-600 text-white'
                                                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                                }`}
                                            >
                                                <tab.icon className="h-4 w-4" />
                                                {tab.label}
                                            </button>
                                        ))}
                                    </nav>
                                </div>

                                {/* Payment Management Tab - Pending Payments Only */}
                                {activePaymentTab === 'management' && (
                                    <div>
                                        <div className="mb-4">
                                            <h3 className="text-lg font-semibold text-white">
                                                {t('pending_payments_awaiting_review')}
                                            </h3>
                                            <p className="text-sm text-gray-400">
                                                {t('review_and_approve_or_reject')}
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            {payments
                                                .filter((p) => p.status === 'pending')
                                                .map((payment) => (
                                                    <div
                                                        key={payment.id}
                                                        className="rounded-lg border border-yellow-500 bg-gray-800 p-6"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-4">
                                                                    <div>
                                                                        <h3 className="text-lg font-semibold text-white">
                                                                            {payment.user.name}
                                                                        </h3>
                                                                        <p className="text-sm text-gray-400">
                                                                            {payment.user.email}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <div className="text-2xl font-bold text-white">
                                                                            ฿
                                                                            {payment.amount.toLocaleString()}
                                                                        </div>
                                                                        <div className="text-sm text-gray-400">
                                                                            {payment.plan_type ===
                                                                            'token_purchase'
                                                                                ? t('token_purchase')
                                                                                : `${payment.plan_type.toUpperCase()} - ${payment.months} ${payment.months > 1 ? t('months') : t('month')}`}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <div className="text-lg font-semibold text-blue-400">
                                                                            {payment.tokens_purchased.toLocaleString()}{' '}
                                                                            {t('tokens')}
                                                                        </div>
                                                                        <div className="text-sm text-gray-400">
                                                                            {new Date(
                                                                                payment.created_at
                                                                            ).toLocaleDateString()}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {payment.notes && (
                                                                    <div className="mt-3">
                                                                        <p className="text-sm text-gray-300">
                                                                            <strong>
                                                                                {t('user_notes')}:
                                                                            </strong>{' '}
                                                                            {payment.notes}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {payment.payment_proof && (
                                                                    <div className="mt-3">
                                                                        <p className="mb-2 text-sm text-gray-300">
                                                                            <strong>
                                                                                {t('payment_proof')}:
                                                                            </strong>
                                                                        </p>
                                                                        {payment.payment_proof.startsWith(
                                                                            'payment_proofs/'
                                                                        ) ? (
                                                                            <div className="relative inline-block">
                                                                                <img
                                                                                    src={`/storage/${payment.payment_proof}`}
                                                                                    alt="Payment proof"
                                                                                    className="max-h-48 max-w-xs cursor-pointer rounded-lg border border-gray-600 transition-opacity hover:opacity-80"
                                                                                    onClick={() =>
                                                                                        window.open(
                                                                                            `/storage/${payment.payment_proof}`,
                                                                                            '_blank'
                                                                                        )
                                                                                    }
                                                                                    onError={(
                                                                                        e
                                                                                    ) => {
                                                                                        const target =
                                                                                            e.target as HTMLImageElement;
                                                                                        target.style.display =
                                                                                            'none';
                                                                                        const fallback =
                                                                                            target.nextElementSibling as HTMLElement;
                                                                                        if (
                                                                                            fallback
                                                                                        )
                                                                                            fallback.style.display =
                                                                                                'block';
                                                                                    }}
                                                                                />
                                                                                <div
                                                                                    className="flex max-h-48 max-w-xs items-center justify-center rounded-lg border border-gray-600 bg-gray-700 text-sm text-gray-400"
                                                                                    style={{
                                                                                        display:
                                                                                            'none',
                                                                                    }}
                                                                                >
                                                                                    <div className="text-center">
                                                                                        <div className="mb-2 text-2xl">
                                                                                            📷
                                                                                        </div>
                                                                                        <div>
                                                                                            {t('image_not_found')}
                                                                                        </div>
                                                                                        <div className="text-xs">
                                                                                            {
                                                                                                payment.payment_proof
                                                                                            }
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-sm text-gray-300">
                                                                                {
                                                                                    payment.payment_proof
                                                                                }
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="ml-6 flex flex-col items-end gap-2">
                                                                <span className="rounded-full bg-yellow-600 px-3 py-1 text-xs font-medium text-white">
                                                                    {t('pending')}
                                                                </span>

                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedPayment(payment);
                                                                        setShowPaymentModal(true);
                                                                    }}
                                                                    className="rounded bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
                                                                >
                                                                    {t('review')}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                            {payments.filter((p) => p.status === 'pending')
                                                .length === 0 && (
                                                <div className="py-8 text-center">
                                                    <FaCreditCard className="mx-auto h-12 w-12 text-gray-400" />
                                                    <p className="mt-2 text-gray-400">
                                                        {t('no_pending_payments')}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        {t('all_payments_processed')}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Payment History Tab - All Processed Payments */}
                                {activePaymentTab === 'history' && (
                                    <div>
                                        <div className="mb-4">
                                            <h3 className="text-lg font-semibold text-white">
                                                {t('payment_history_all_processed')}
                                            </h3>
                                            <p className="text-sm text-gray-400">
                                                {t('complete_history')}
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            {payments
                                                .filter((p) => p.status !== 'pending')
                                                .map((payment) => (
                                                    <div
                                                        key={payment.id}
                                                        className={`rounded-lg border bg-gray-800 p-6 ${
                                                            payment.status === 'approved'
                                                                ? 'border-green-500'
                                                                : 'border-red-500'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-4">
                                                                    <div>
                                                                        <h3 className="text-lg font-semibold text-white">
                                                                            {payment.user.name}
                                                                        </h3>
                                                                        <p className="text-sm text-gray-400">
                                                                            {payment.user.email}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <div className="text-2xl font-bold text-white">
                                                                            ฿
                                                                            {payment.amount.toLocaleString()}
                                                                        </div>
                                                                        <div className="text-sm text-gray-400">
                                                                            {payment.plan_type ===
                                                                            'token_purchase'
                                                                                ? t('token_purchase')
                                                                                : `${payment.plan_type.toUpperCase()} - ${payment.months} ${payment.months > 1 ? t('months') : t('month')}`}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <div className="text-lg font-semibold text-blue-400">
                                                                            {payment.tokens_purchased.toLocaleString()}{' '}
                                                                            {t('tokens')}
                                                                        </div>
                                                                        <div className="text-sm text-gray-400">
                                                                            {new Date(
                                                                                payment.created_at
                                                                            ).toLocaleDateString()}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {payment.notes && (
                                                                    <div className="mt-3">
                                                                        <p className="text-sm text-gray-300">
                                                                            <strong>
                                                                                {t('user_notes')}:
                                                                            </strong>{' '}
                                                                            {payment.notes}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {payment.payment_proof && (
                                                                    <div className="mt-3">
                                                                        <p className="text-sm text-gray-300">
                                                                            <strong>
                                                                                {t('payment_proof')}:
                                                                            </strong>{' '}
                                                                            {payment.payment_proof}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {payment.admin_notes && (
                                                                    <div className="mt-3">
                                                                        <p className="text-sm text-gray-300">
                                                                            <strong>
                                                                                {t('admin_notes')}:
                                                                            </strong>{' '}
                                                                            {payment.admin_notes}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="ml-6 flex flex-col items-end gap-2">
                                                                <span
                                                                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                                                                        payment.status ===
                                                                        'approved'
                                                                            ? 'bg-green-600 text-white'
                                                                            : 'bg-red-600 text-white'
                                                                    }`}
                                                                >
                                                                    {payment.status.toUpperCase()}
                                                                </span>

                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedPayment(payment);
                                                                        setShowPaymentEditModal(
                                                                            true
                                                                        );
                                                                    }}
                                                                    className="rounded bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
                                                                >
                                                                    Edit
                                                                </button>

                                                                {payment.approver && (
                                                                    <div className="text-xs text-gray-400">
                                                                        {payment.status ===
                                                                        'approved'
                                                                            ? 'Approved'
                                                                            : 'Rejected'}{' '}
                                                                        by {payment.approver.name}
                                                                        <br />
                                                                        {payment.approved_at &&
                                                                            new Date(
                                                                                payment.approved_at
                                                                            ).toLocaleDateString()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                            {payments.filter((p) => p.status !== 'pending')
                                                .length === 0 && (
                                                <div className="py-8 text-center">
                                                    <FaChartBar className="mx-auto h-12 w-12 text-gray-400" />
                                                    <p className="mt-2 text-gray-400">
                                                        {t('no_payment_history')}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        {t('no_payments_processed_yet')}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'users' && (
                            <div>
                                <div className="mb-6 flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-white">
                                        {t('user_management')}
                                    </h2>
                                    <button
                                        onClick={() => setShowCreateUserModal(true)}
                                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                                    >
                                        <FaPlus className="h-4 w-4" />
                                        {t('create_user')}
                                    </button>
                                </div>

                                {/* Search and View Controls */}
                                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex max-w-2xl flex-1 gap-4">
                                        <div className="max-w-md flex-1">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder={t('search_users')}
                                                    value={userSearchTerm}
                                                    onChange={(e) =>
                                                        setUserSearchTerm(e.target.value)
                                                    }
                                                    className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 pl-10 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                                                />
                                                <svg
                                                    className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                                    />
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="min-w-40">
                                            <select
                                                value={userRoleFilter}
                                                onChange={(e) =>
                                                    setUserRoleFilter(
                                                        e.target.value as
                                                            | 'all'
                                                            | 'super_user'
                                                            | 'sales'
                                                            | 'user'
                                                    )
                                                }
                                                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                                            >
                                                <option value="all">
                                                    {t('all_roles')}
                                                </option>
                                                <option value="super_user">
                                                    {t('admin_role')}
                                                </option>
                                                <option value="sales">
                                                    {t('sales_role')}
                                                </option>
                                                <option value="user">{t('user_role')}</option>
                                            </select>
                                        </div>
                                        <div className="min-w-48">
                                            <select
                                                value={userSortOption}
                                                onChange={(e) =>
                                                    setUserSortOption(
                                                        e.target.value as
                                                            | 'default'
                                                            | 'newest'
                                                            | 'oldest'
                                                            | 'name_asc'
                                                            | 'name_desc'
                                                    )
                                                }
                                                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                                            >
                                                <option value="default">
                                                    {t('filter_data') || 'กรองข้อมูล'}
                                                </option>
                                                <option value="newest">
                                                    {t('newest_members') || 'สมาชิกใหม่สุด'}
                                                </option>
                                                <option value="oldest">
                                                    {t('oldest_members') || 'สมาชิกเก่าสุด'}
                                                </option>
                                                <option value="name_asc">
                                                    {t('sort_name_asc') || 'เรียงจาก ก-ฮ'}
                                                </option>
                                                <option value="name_desc">
                                                    {t('sort_name_desc') || 'เรียงจาก ฮ-ก'}
                                                </option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex rounded-lg border border-gray-600 bg-gray-700 p-1">
                                            <button
                                                onClick={() => setUserViewMode('grid')}
                                                className={`flex items-center gap-2 rounded px-3 py-1 text-sm transition-colors ${
                                                    userViewMode === 'grid'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'text-gray-400 hover:text-white'
                                                }`}
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                                </svg>
                                                {t('grid')}
                                            </button>
                                            <button
                                                onClick={() => setUserViewMode('table')}
                                                className={`flex items-center gap-2 rounded px-3 py-1 text-sm transition-colors ${
                                                    userViewMode === 'table'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'text-gray-400 hover:text-white'
                                                }`}
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                                {t('table')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {/* User Display */}
                                {userViewMode === 'grid' ? (
                                    <>
                                        {paginatedUsers.length === 0 ? (
                                            <div className="py-12 text-center">
                                                <FaUsers className="mx-auto h-12 w-12 text-gray-400" />
                                                <p className="mt-2 text-gray-400">
                                                    {userSearchTerm
                                                        ? t('no_users_found') ||
                                                          'No users found matching your search'
                                                        : t('no_users') || 'No users found'}
                                                </p>
                                                {userSearchTerm && (
                                                    <button
                                                        onClick={() => setUserSearchTerm('')}
                                                        className="mt-2 text-sm text-blue-400 hover:text-blue-300"
                                                    >
                                                        {t('clear_search') || 'Clear search'}
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                                {paginatedUsers.map((user) => {
                                                    const RoleIcon =
                                                        user.role === 'super_user'
                                                            ? FaUserShield
                                                            : user.role === 'sales'
                                                              ? FaUserTie
                                                              : FaUser;
                                                    const roleColors = {
                                                        super_user: {
                                                            bg: 'from-amber-500/20 via-amber-600/10 to-amber-500/20',
                                                            border: 'border-amber-500/30',
                                                            accent: 'text-amber-400',
                                                            badge: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
                                                            button: 'bg-amber-600 hover:bg-amber-700',
                                                        },
                                                        sales: {
                                                            bg: 'from-purple-500/20 via-purple-600/10 to-purple-500/20',
                                                            border: 'border-purple-500/30',
                                                            accent: 'text-purple-400',
                                                            badge: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
                                                            button: 'bg-purple-600 hover:bg-purple-700',
                                                        },
                                                        user: {
                                                            bg: 'from-blue-500/20 via-blue-600/10 to-blue-500/20',
                                                            border: 'border-blue-500/30',
                                                            accent: 'text-blue-400',
                                                            badge: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
                                                            button: 'bg-blue-600 hover:bg-blue-700',
                                                        },
                                                    };
                                                    const colors = roleColors[user.role] || roleColors.user;

                                                    return (
                                                        <div
                                                            key={user.id}
                                                            className={`group relative flex flex-col overflow-hidden rounded-2xl border ${colors.border} bg-gradient-to-br ${colors.bg} backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-gray-900/50`}
                                                        >
                                                            {/* Header with gradient */}
                                                            <div className={`relative h-20 bg-gradient-to-r ${
                                                                user.role === 'super_user'
                                                                    ? 'from-amber-600 via-amber-500 to-amber-600'
                                                                    : user.role === 'sales'
                                                                      ? 'from-purple-600 via-purple-500 to-purple-600'
                                                                      : 'from-blue-600 via-blue-500 to-blue-600'
                                                            }`}>
                                                                <div className="absolute inset-0 bg-black/10"></div>
                                                                {/* Role Badge */}
                                                                <div className="absolute right-3 top-3">
                                                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${colors.badge} backdrop-blur-sm`}>
                                                                        <RoleIcon className="h-3 w-3" />
                                                                        {user.role === 'super_user'
                                                                            ? t('Admin') || 'Admin'
                                                                            : user.role === 'sales'
                                                                              ? t('Sales') || 'Sales'
                                                                              : t('User') || 'User'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Avatar */}
                                                            <div className="relative -mt-10 flex justify-center">
                                                                <div className={`relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-gray-800 bg-gradient-to-br ${
                                                                    user.role === 'super_user'
                                                                        ? 'from-amber-400 to-amber-600'
                                                                        : user.role === 'sales'
                                                                          ? 'from-purple-400 to-purple-600'
                                                                          : 'from-blue-400 to-blue-600'
                                                                } shadow-xl ring-4 ring-gray-900/50`}>
                                                                    <RoleIcon className="h-8 w-8 text-white" />
                                                                    {user.is_super_user && (
                                                                        <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 border-2 border-gray-800">
                                                                            <FaCheck className="h-3 w-3 text-white" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* User Info */}
                                                            <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
                                                                <h3 className="mb-1 text-center text-lg font-bold text-white">
                                                                    {user.name}
                                                                </h3>
                                                                
                                                                {/* Email */}
                                                                <div className="mb-3 flex items-center justify-center gap-2 text-sm text-gray-400">
                                                                    <FaEnvelope className="h-3.5 w-3.5" />
                                                                    <span className="truncate font-mono text-xs">
                                                                        {user.email}
                                                                    </span>
                                                                </div>

                                                                {/* Phone */}
                                                                {user.phone && (
                                                                    <div className="mb-3 flex items-center justify-center gap-2 text-sm text-gray-400">
                                                                        <FaPhone className="h-3.5 w-3.5" />
                                                                        <span className="text-xs">{user.phone}</span>
                                                                    </div>
                                                                )}

                                                                {/* Additional Details */}
                                                                {user.additional_details && (
                                                                    <div className="mb-3 rounded-lg border border-gray-700/50 bg-gray-800/50 p-2">
                                                                        <p className="line-clamp-2 text-xs text-gray-400">
                                                                            {user.additional_details}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {/* Stats Grid */}
                                                                <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-gray-700/50 bg-gray-800/30 p-3">
                                                                    <div className="flex flex-col items-center">
                                                                        <div className={`mb-1 text-xl font-bold ${colors.accent}`}>
                                                                            {user.fields_count ?? 0}
                                                                        </div>
                                                                        <div className="flex items-center gap-1 text-xs text-gray-400">
                                                                            <FaMap className="h-3 w-3" />
                                                                            <span>{t('fields')}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col items-center">
                                                                        <div className={`mb-1 text-xl font-bold ${colors.accent}`}>
                                                                            {user.folders_count ?? 0}
                                                                        </div>
                                                                        <div className="flex items-center gap-1 text-xs text-gray-400">
                                                                            <FaFolder className="h-3 w-3" />
                                                                            <span>{t('folders')}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col items-center">
                                                                        <div className="mb-1 flex items-center gap-1 text-xs text-gray-400">
                                                                            <FaCalendarAlt className="h-3 w-3" />
                                                                        </div>
                                                                        <div className="text-xs text-gray-500">
                                                                            {new Date(user.created_at).toLocaleDateString('en-US', {
                                                                                month: 'short',
                                                                                day: 'numeric',
                                                                                year: 'numeric',
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Action Buttons */}
                                                                <div className="mt-auto flex flex-col gap-2">
                                                                    <button
                                                                        onClick={async () => {
                                                                            setSelectedUser(user);
                                                                            setShowViewProjectsModal(true);
                                                                            setLoadingUserProjects(true);
                                                                            try {
                                                                                // Fetch user's folders and fields
                                                                                const [foldersRes, fieldsRes] = await Promise.all([
                                                                                    axios.get(`/api/users/${user.id}/folders`),
                                                                                    axios.get(`/fields-api?user_id=${user.id}`)
                                                                                ]);
                                                                                setUserFolders(foldersRes.data.folders || []);
                                                                                setUserFields(fieldsRes.data.fields || []);
                                                                            } catch (error) {
                                                                                console.error('Error loading user projects:', error);
                                                                            } finally {
                                                                                setLoadingUserProjects(false);
                                                                            }
                                                                        }}
                                                                        className={`flex items-center justify-center gap-2 rounded-lg ${colors.button} px-3 py-2 text-sm font-medium text-white transition-all hover:shadow-lg`}
                                                                    >
                                                                        <FaEye className="h-4 w-4" />
                                                                        <span>{t('view_projects') || 'ดูโครงการ'}</span>
                                                                    </button>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedUser(user);
                                                                                setShowEditUserModal(true);
                                                                            }}
                                                                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg ${colors.button} px-3 py-2 text-sm font-medium text-white transition-all hover:shadow-lg`}
                                                                        >
                                                                            <FaEdit className="h-4 w-4" />
                                                                            <span>{t('edit')}</span>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteUser(user.id)}
                                                                            className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 hover:shadow-lg"
                                                                        >
                                                                            <FaTrash className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    /* Table View */
                                    <div className="overflow-hidden rounded-xl border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-gradient-to-r from-gray-800 to-gray-700/50">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                                                            {t('user') || 'User'}
                                                        </th>
                                                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                                                            <div className="flex items-center gap-2">
                                                                <FaEnvelope className="h-3.5 w-3.5" />
                                                                {t('email') || 'Email'}
                                                            </div>
                                                        </th>
                                                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                                                            <div className="flex items-center gap-2">
                                                                <FaPhone className="h-3.5 w-3.5" />
                                                                {t('phone') || 'Phone'}
                                                            </div>
                                                        </th>
                                                        <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-300">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <FaMap className="h-3.5 w-3.5" />
                                                                {t('fields') || 'Fields'}
                                                            </div>
                                                        </th>
                                                        <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-300">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <FaFolder className="h-3.5 w-3.5" />
                                                                {t('folders') || 'Folders'}
                                                            </div>
                                                        </th>
                                                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                                                            <div className="flex items-center gap-2">
                                                                <FaCalendarAlt className="h-3.5 w-3.5" />
                                                                {t('joined') || 'Joined'}
                                                            </div>
                                                        </th>
                                                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                                                            {t('status') || 'Status'}
                                                        </th>
                                                        <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-300">
                                                            {t('actions') || 'Actions'}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-700/50">
                                                    {paginatedUsers.map((user) => {
                                                        const RoleIcon =
                                                            user.role === 'super_user'
                                                                ? FaUserShield
                                                                : user.role === 'sales'
                                                                  ? FaUserTie
                                                                  : FaUser;
                                                        const roleStyles = {
                                                            super_user: {
                                                                iconBg: 'from-amber-500 to-amber-600',
                                                                text: 'text-amber-400',
                                                                badge: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
                                                            },
                                                            sales: {
                                                                iconBg: 'from-purple-500 to-purple-600',
                                                                text: 'text-purple-400',
                                                                badge: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
                                                            },
                                                            user: {
                                                                iconBg: 'from-blue-500 to-blue-600',
                                                                text: 'text-blue-400',
                                                                badge: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
                                                            },
                                                        };
                                                        const styles = roleStyles[user.role] || roleStyles.user;

                                                        return (
                                                            <tr
                                                                key={user.id}
                                                                className="transition-all hover:bg-gray-700/30"
                                                            >
                                                                <td className="whitespace-nowrap px-6 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${styles.iconBg} shadow-lg ring-2 ring-gray-700/50`}>
                                                                            <RoleIcon className="h-5 w-5 text-white" />
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-sm font-semibold text-white">
                                                                                {user.name}
                                                                            </div>
                                                                            {user.is_super_user && (
                                                                                <div className="mt-0.5 flex items-center gap-1">
                                                                                    <FaCheck className="h-2.5 w-2.5 text-yellow-400" />
                                                                                    <span className="text-xs text-yellow-400">Super User</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="whitespace-nowrap px-6 py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <FaEnvelope className="h-3.5 w-3.5 text-gray-500" />
                                                                        <span className="font-mono text-sm text-gray-300">
                                                                            {user.email}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="whitespace-nowrap px-6 py-4">
                                                                    {user.phone ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <FaPhone className="h-3.5 w-3.5 text-gray-500" />
                                                                            <span className="text-sm text-gray-300">
                                                                                {user.phone}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-sm text-gray-500">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="whitespace-nowrap px-6 py-4 text-center">
                                                                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-1.5">
                                                                        <FaMap className="h-3.5 w-3.5 text-blue-400" />
                                                                        <span className="text-sm font-semibold text-white">
                                                                            {user.fields_count ?? 0}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="whitespace-nowrap px-6 py-4 text-center">
                                                                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-3 py-1.5">
                                                                        <FaFolder className="h-3.5 w-3.5 text-purple-400" />
                                                                        <span className="text-sm font-semibold text-white">
                                                                            {user.folders_count ?? 0}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="whitespace-nowrap px-6 py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <FaCalendarAlt className="h-3.5 w-3.5 text-gray-500" />
                                                                        <span className="text-sm text-gray-300">
                                                                            {new Date(user.created_at).toLocaleDateString('en-US', {
                                                                                month: 'short',
                                                                                day: 'numeric',
                                                                                year: 'numeric',
                                                                            })}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="whitespace-nowrap px-6 py-4">
                                                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${styles.badge}`}>
                                                                        <RoleIcon className="h-3 w-3" />
                                                                        {user.role === 'super_user'
                                                                            ? t('Admin') || 'Admin'
                                                                            : user.role === 'sales'
                                                                              ? t('Sales') || 'Sales'
                                                                              : t('User') || 'User'}
                                                                    </span>
                                                                </td>
                                                                <td className="whitespace-nowrap px-6 py-4 text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedUser(user);
                                                                                setShowEditUserModal(true);
                                                                            }}
                                                                            className="rounded-lg bg-blue-600/20 p-2 text-blue-400 transition-all hover:bg-blue-600/30 hover:text-blue-300"
                                                                            title={t('edit') || 'Edit'}
                                                                        >
                                                                            <FaEdit className="h-4 w-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteUser(user.id)}
                                                                            className="rounded-lg bg-red-600/20 p-2 text-red-400 transition-all hover:bg-red-600/30 hover:text-red-300"
                                                                            title={t('delete') || 'Delete'}
                                                                        >
                                                                            <FaTrash className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {paginatedUsers.length === 0 && (
                                            <div className="py-12 text-center">
                                                <FaUsers className="mx-auto h-12 w-12 text-gray-400" />
                                                <p className="mt-2 text-gray-400">
                                                    {userSearchTerm
                                                        ? t('no_users_found') ||
                                                          'No users found matching your search'
                                                        : t('no_users') || 'No users found'}
                                                </p>
                                                {userSearchTerm && (
                                                    <button
                                                        onClick={() => setUserSearchTerm('')}
                                                        className="mt-2 text-sm text-blue-400 hover:text-blue-300"
                                                    >
                                                        {t('clear_search') || 'Clear search'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="mt-6 flex items-center justify-between">
                                        <div className="text-sm text-gray-400">
                                            {t('showing') || 'Showing'} {startIndex + 1}{' '}
                                            {t('to') || 'to'} {Math.min(endIndex, totalUsers)}{' '}
                                            {t('of') || 'of'} {totalUsers} {t('users') || 'users'}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {/* Previous Button */}
                                            <button
                                                onClick={() =>
                                                    setCurrentUserPage(
                                                        Math.max(1, currentUserPage - 1)
                                                    )
                                                }
                                                disabled={currentUserPage === 1}
                                                className="flex items-center rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <svg
                                                    className="mr-1 h-4 w-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M15 19l-7-7 7-7"
                                                    />
                                                </svg>
                                                {t('previous') || 'Previous'}
                                            </button>

                                            {/* Page Numbers */}
                                            <div className="flex items-center space-x-1">
                                                {(() => {
                                                    const pages: React.ReactNode[] = [];
                                                    const maxVisiblePages = 5;
                                                    let startPage = Math.max(
                                                        1,
                                                        currentUserPage -
                                                            Math.floor(maxVisiblePages / 2)
                                                    );
                                                    const endPage = Math.min(
                                                        totalPages,
                                                        startPage + maxVisiblePages - 1
                                                    );

                                                    // Adjust start page if we're near the end
                                                    if (endPage - startPage + 1 < maxVisiblePages) {
                                                        startPage = Math.max(
                                                            1,
                                                            endPage - maxVisiblePages + 1
                                                        );
                                                    }

                                                    // First page and ellipsis
                                                    if (startPage > 1) {
                                                        pages.push(
                                                            <button
                                                                key={1}
                                                                onClick={() =>
                                                                    setCurrentUserPage(1)
                                                                }
                                                                className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
                                                            >
                                                                1
                                                            </button>
                                                        );
                                                        if (startPage > 2) {
                                                            pages.push(
                                                                <span
                                                                    key="ellipsis1"
                                                                    className="px-2 text-gray-500"
                                                                >
                                                                    ...
                                                                </span>
                                                            );
                                                        }
                                                    }

                                                    // Page numbers
                                                    for (let i = startPage; i <= endPage; i++) {
                                                        pages.push(
                                                            <button
                                                                key={i}
                                                                onClick={() =>
                                                                    setCurrentUserPage(i)
                                                                }
                                                                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                                                    i === currentUserPage
                                                                        ? 'border border-blue-500 bg-blue-600 text-white'
                                                                        : 'border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                                                                }`}
                                                            >
                                                                {i}
                                                            </button>
                                                        );
                                                    }

                                                    // Last page and ellipsis
                                                    if (endPage < totalPages) {
                                                        if (endPage < totalPages - 1) {
                                                            pages.push(
                                                                <span
                                                                    key="ellipsis2"
                                                                    className="px-2 text-gray-500"
                                                                >
                                                                    ...
                                                                </span>
                                                            );
                                                        }
                                                        pages.push(
                                                            <button
                                                                key={totalPages}
                                                                onClick={() =>
                                                                    setCurrentUserPage(totalPages)
                                                                }
                                                                className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
                                                            >
                                                                {totalPages}
                                                            </button>
                                                        );
                                                    }

                                                    return pages;
                                                })()}
                                            </div>

                                            {/* Next Button */}
                                            <button
                                                onClick={() =>
                                                    setCurrentUserPage(
                                                        Math.min(totalPages, currentUserPage + 1)
                                                    )
                                                }
                                                disabled={currentUserPage === totalPages}
                                                className="flex items-center rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {t('next') || 'Next'}
                                                <svg
                                                    className="ml-1 h-4 w-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M9 5l7 7-7 7"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>
            <Footer />

            {/* Create Folder Modal */}
            {showCreateFolderModal && (
                <CreateFolderModal
                    isOpen={showCreateFolderModal}
                    onClose={() => setShowCreateFolderModal(false)}
                    onCreate={handleCreateFolder}
                    users={users}
                    t={t}
                />
            )}

            {/* Create User Modal */}
            {showCreateUserModal && (
                <CreateUserModal
                    isOpen={showCreateUserModal}
                    onClose={() => setShowCreateUserModal(false)}
                    onCreate={handleCreateUser}
                    t={t}
                />
            )}

            {/* Edit User Modal */}
            {showEditUserModal && selectedUser && (
                <EditUserModal
                    isOpen={showEditUserModal}
                    onClose={() => {
                        setShowEditUserModal(false);
                        setSelectedUser(null);
                    }}
                    onUpdate={handleUpdateUser}
                    user={selectedUser}
                    t={t}
                />
            )}

            {/* Payment Review Modal */}
            {showPaymentModal && selectedPayment && (
                <PaymentReviewModal
                    isOpen={showPaymentModal}
                    onClose={() => {
                        setShowPaymentModal(false);
                        setSelectedPayment(null);
                    }}
                    payment={selectedPayment}
                    onApprove={handleApprovePayment}
                    onReject={handleRejectPayment}
                    t={t}
                />
            )}

            {/* Payment Edit Modal */}
            {showPaymentEditModal && selectedPayment && (
                <PaymentEditModal
                    isOpen={showPaymentEditModal}
                    onClose={() => {
                        setShowPaymentEditModal(false);
                        setSelectedPayment(null);
                    }}
                    payment={selectedPayment}
                    onUpdate={handleUpdatePayment}
                    t={t}
                />
            )}

            {/* View User Projects Modal */}
            {showViewProjectsModal && selectedUser && (
                <ViewUserProjectsModal
                    isOpen={showViewProjectsModal}
                    onClose={() => {
                        setShowViewProjectsModal(false);
                        setSelectedUser(null);
                        setUserFolders([]);
                        setUserFields([]);
                    }}
                    user={selectedUser}
                    folders={userFolders}
                    fields={userFields}
                    loading={loadingUserProjects}
                    onRename={handleRenameProject}
                    onMove={handleMoveProject}
                    onCopy={handleCopyProject}
                    onShare={handleShareProject}
                    onDelete={handleDeleteField}
                    isSuperUser={true}
                    t={t}
                />
            )}

            {/* Rename Project Modal */}
            {fieldToRename && (
                <RenameProjectModal
                    isOpen={showRenameModal}
                    onClose={() => {
                        setShowRenameModal(false);
                        setFieldToRename(null);
                    }}
                    onRename={handleSubmitRename}
                    currentName={fieldToRename.name}
                    t={t}
                />
            )}

            {/* Folder Selection Modal for Move/Copy */}
            <FolderSelectionModal
                isOpen={showFolderSelectionModal}
                onClose={() => {
                    setShowFolderSelectionModal(false);
                    setFieldToMoveOrCopy(null);
                }}
                onSelect={async (folderId) => {
                    if (!fieldToMoveOrCopy) return;
                    
                    try {
                        if (folderSelectionAction === 'move') {
                            const response = await axios.put(`/api/fields/${fieldToMoveOrCopy.id}/folder`, {
                                folder_id: folderId ? parseInt(folderId) : null,
                            });
                            
                            if (response.data.success) {
                                // Update field in userFields
                                setUserFields(prev => prev.map(f => 
                                    f.id === fieldToMoveOrCopy.id ? { ...f, folderId: folderId } : f
                                ));
                                alert(t('move_project_success'));
                            }
                        } else {
                            // Copy project
                            const response = await axios.post(`/api/fields/${fieldToMoveOrCopy.id}/copy`, {
                                folder_id: folderId ? parseInt(folderId) : null,
                            });
                            
                            if (response.data.success && response.data.field) {
                                setUserFields(prev => [...prev, response.data.field]);
                                alert(t('copy_project_success'));
                            }
                        }
                    } catch (error: any) {
                        console.error(`Error ${folderSelectionAction} project:`, error);
                        alert(`Error ${folderSelectionAction} project: ${error.response?.data?.message || error.message}`);
                    }
                }}
                action={folderSelectionAction}
                currentFolderId={fieldToMoveOrCopy?.folderId}
                folders={userFolders}
                t={t}
            />

            {/* Share To User Modal */}
            <ShareToUserModal
                isOpen={showShareModal && !showUserFolderSelectionModal}
                onClose={() => {
                    setShowShareModal(false);
                    setFieldToShare(null);
                    setSelectedUserForShare(null);
                    setUserFoldersForShare([]);
                }}
                onSelectUser={async (user) => {
                    setSelectedUserForShare(user);
                    // Fetch user's folders
                    try {
                        const response = await axios.get(`/api/users/${user.id}/folders`);
                        setUserFoldersForShare(response.data.folders || []);
                        setShowUserFolderSelectionModal(true);
                    } catch (error) {
                        console.error('Error fetching user folders:', error);
                        alert('Error fetching user folders');
                    }
                }}
                t={t}
            />

            {/* User Folder Selection Modal for Share */}
            {selectedUserForShare && (
                <FolderSelectionModal
                    isOpen={showUserFolderSelectionModal}
                    onClose={() => {
                        setShowUserFolderSelectionModal(false);
                        setSelectedUserForShare(null);
                        setUserFoldersForShare([]);
                        setFieldToShare(null);
                        setShowShareModal(false);
                    }}
                    onSelect={async (folderId) => {
                        if (!fieldToShare || !selectedUserForShare) {
                            alert('Error: Missing required data. Please try again.');
                            return;
                        }
                        
                        try {
                            // Share project to user
                            const response = await axios.post(`/api/fields/${fieldToShare.id}/share`, {
                                user_id: selectedUserForShare.id,
                                folder_id: folderId ? parseInt(folderId) : null,
                            });
                            
                            if (response.data.success) {
                                alert(t('share_project_success') || 'แชร์โครงการสำเร็จ');
                            } else {
                                alert(`Error sharing project: ${response.data.message || 'Unknown error'}`);
                            }
                        } catch (error: any) {
                            console.error('Error sharing project:', error);
                            alert(`Error sharing project: ${error.response?.data?.message || error.message}`);
                        } finally {
                            setShowUserFolderSelectionModal(false);
                            setSelectedUserForShare(null);
                            setUserFoldersForShare([]);
                            setFieldToShare(null);
                            setShowShareModal(false);
                        }
                    }}
                    action="share"
                    folders={userFoldersForShare}
                    showAllFolders={true}
                    t={t}
                />
            )}

            {/* Delete Field Confirmation Dialog */}
            {showDeleteConfirm && fieldToDelete && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
                    <div className="relative z-[10000] mx-4 w-full max-w-md rounded-lg bg-gray-800 p-6">
                        <div className="mb-4 flex items-center">
                            <div className="flex-shrink-0">
                                <svg
                                    className="h-6 w-6 text-red-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                    />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-lg font-medium text-white">
                                    {t('delete_project') || 'ลบโครงการ'}
                                </h3>
                            </div>
                        </div>
                        <div className="mb-6">
                            <p className="text-gray-300">
                                {t('delete_confirm') || 'คุณแน่ใจหรือไม่ที่จะลบโครงการ'}{' '}
                                <span className="font-semibold text-white">
                                    "{fieldToDelete.name}"
                                </span>
                                ?
                            </p>
                            <p className="mt-2 text-sm text-gray-400">{t('delete_warning') || 'การลบนี้ไม่สามารถยกเลิกได้'}</p>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={cancelDelete}
                                disabled={deleting}
                                className="rounded px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="flex items-center rounded bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                            >
                                {deleting ? (
                                    <>
                                        <svg
                                            className="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        {t('deleting') || 'กำลังลบ...'}
                                    </>
                                ) : (
                                    t('delete') || 'ลบ'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Create Folder Modal Component
const CreateFolderModal = ({
    isOpen,
    onClose,
    onCreate,
    users,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (folder: Omit<Folder, 'id' | 'created_at' | 'user'> & { user_id: number }) => void;
    users: User[];
    t: (key: string) => string;
}) => {
    const [folderName, setFolderName] = useState('');
    const [folderType, setFolderType] = useState<'custom'>('custom');
    const [folderColor, setFolderColor] = useState('#6366f1');
    const [folderIcon, setFolderIcon] = useState('📁');
    const [selectedUserId, setSelectedUserId] = useState<number | ''>('');

    const colors = [
        { name: 'Blue', value: '#3b82f6' },
        { name: 'Green', value: '#10b981' },
        { name: 'Purple', value: '#8b5cf6' },
        { name: 'Red', value: '#ef4444' },
        { name: 'Yellow', value: '#f59e0b' },
        { name: 'Pink', value: '#ec4899' },
    ];

    const icons = ['📁', '📂', '🗂️', '📋', '📝', '📌', '🏷️', '⭐', '💡', '🎯'];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!folderName.trim() || !selectedUserId) return;

        onCreate({
            name: folderName.trim(),
            type: folderType,
            user_id: selectedUserId as number,
            color: folderColor,
            icon: folderIcon,
        });

        setFolderName('');
        setFolderColor('#6366f1');
        setFolderIcon('📁');
        setSelectedUserId('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
            <div className="relative z-[10000] mx-4 w-full max-w-md rounded-lg bg-gray-800 p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">{t('create_folder')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <svg
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('select_user')}
                        </label>
                        <select
                            value={selectedUserId}
                            onChange={(e) =>
                                setSelectedUserId(e.target.value ? Number(e.target.value) : '')
                            }
                            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                            required
                        >
                            <option value="">{t('select_user')}</option>
                            {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.name} ({user.email})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('folder_name')}
                        </label>
                        <input
                            type="text"
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                            placeholder={t('enter_folder_name')}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('folder_icon')}
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            {icons.map((icon) => (
                                <button
                                    key={icon}
                                    type="button"
                                    onClick={() => setFolderIcon(icon)}
                                    className={`rounded p-2 text-xl ${
                                        folderIcon === icon
                                            ? 'bg-blue-600'
                                            : 'bg-gray-700 hover:bg-gray-600'
                                    }`}
                                >
                                    {icon}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mb-6">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('folder_color')}
                        </label>
                        <div className="grid grid-cols-6 gap-2">
                            {colors.map((color) => (
                                <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => setFolderColor(color.value)}
                                    className={`h-8 w-8 rounded-full border-2 ${
                                        folderColor === color.value
                                            ? 'border-white'
                                            : 'border-gray-600'
                                    }`}
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={!folderName.trim() || !selectedUserId}
                            className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                        >
                            {t('create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Create User Modal Component
const CreateUserModal = ({
    isOpen,
    onClose,
    onCreate,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (user: Omit<User, 'id' | 'created_at'> & { password: string }) => void;
    t: (key: string) => string;
}) => {
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [userPassword, setUserPassword] = useState('');
    const [userRole, setUserRole] = useState<'user' | 'sales' | 'super_user'>('user');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!userName.trim() || !userEmail.trim() || !userPassword.trim()) return;

        onCreate({
            name: userName.trim(),
            email: userEmail.trim(),
            password: userPassword,
            is_super_user: userRole === 'super_user',
            role: userRole,
            phone: '',
            additional_details: '',
        });

        setUserName('');
        setUserEmail('');
        setUserPassword('');
        setUserRole('user');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
            <div className="relative z-[10000] mx-4 w-full max-w-md rounded-lg bg-gray-800 p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">{t('create_user')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <svg
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('name')}
                        </label>
                        <input
                            type="text"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                            placeholder={t('enter_name')}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('email')}
                        </label>
                        <input
                            type="email"
                            value={userEmail}
                            onChange={(e) => setUserEmail(e.target.value)}
                            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                            placeholder={t('enter_email')}
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('password')}
                        </label>
                        <input
                            type="password"
                            value={userPassword}
                            onChange={(e) => setUserPassword(e.target.value)}
                            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                            placeholder={t('enter_password')}
                            required
                            minLength={8}
                        />
                    </div>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('user_role') || 'User Role'}
                        </label>
                        <select
                            value={userRole}
                            onChange={(e) =>
                                setUserRole(e.target.value as 'user' | 'sales' | 'super_user')
                            }
                            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                            required
                        >
                            <option value="user">{t('regular_user') || 'Regular User'}</option>
                            <option value="sales">{t('sales_user') || 'Sales User'}</option>
                            <option value="super_user">{t('super_user') || 'Super User'}</option>
                        </select>
                        {userRole === 'super_user' && (
                            <p className="mt-2 text-xs text-amber-400">
                                {t('super_user_note') || 'Super User will have full administrative access'}
                            </p>
                        )}
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={!userName.trim() || !userEmail.trim() || !userPassword.trim()}
                            className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                        >
                            {t('create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Edit User Modal Component
const EditUserModal = ({
    isOpen,
    onClose,
    onUpdate,
    user,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (userId: number, userData: Partial<User>) => void;
    user: User;
    t: (key: string) => string;
}) => {
    const [userName, setUserName] = useState(user.name);
    const [userEmail, setUserEmail] = useState(user.email);
    const [userPassword, setUserPassword] = useState('');
    const [userRole, setUserRole] = useState<'user' | 'sales' | 'super_user'>(user.role || 'user');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!userName.trim() || !userEmail.trim()) return;

        const updateData: Partial<User> = {
            name: userName.trim(),
            email: userEmail.trim(),
            is_super_user: userRole === 'super_user',
            role: userRole,
        };

        // Only include password if it's provided
        if (userPassword.trim()) {
            (updateData as any).password = userPassword;
        }

        onUpdate(user.id, updateData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
            <div className="relative z-[10000] mx-4 w-full max-w-md rounded-lg bg-gray-800 p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">{t('edit_user')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <svg
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('name')}
                        </label>
                        <input
                            type="text"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                            placeholder={t('enter_name')}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('email')}
                        </label>
                        <input
                            type="email"
                            value={userEmail}
                            onChange={(e) => setUserEmail(e.target.value)}
                            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                            placeholder={t('enter_email')}
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('password')} ({t('optional')})
                        </label>
                        <input
                            type="password"
                            value={userPassword}
                            onChange={(e) => setUserPassword(e.target.value)}
                            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                            placeholder={t('enter_new_password')}
                            minLength={8}
                        />
                        <p className="mt-1 text-xs text-gray-400">
                            {t('leave_blank_to_keep_current_password')}
                        </p>
                    </div>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('user_role') || 'User Role'}
                        </label>
                        <select
                            value={userRole}
                            onChange={(e) =>
                                setUserRole(e.target.value as 'user' | 'sales' | 'super_user')
                            }
                            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                            required
                        >
                            <option value="user">{t('regular_user') || 'Regular User'}</option>
                            <option value="sales">{t('sales_user') || 'Sales User'}</option>
                            <option value="super_user">{t('super_user') || 'Super User'}</option>
                        </select>
                        {userRole === 'super_user' && (
                            <p className="mt-2 text-xs text-amber-400">
                                {t('super_user_note') || 'Super User will have full administrative access'}
                            </p>
                        )}
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={!userName.trim() || !userEmail.trim()}
                            className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                        >
                            {t('update')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// View User Projects Modal Component
const ViewUserProjectsModal = ({
    isOpen,
    onClose,
    user,
    folders,
    fields,
    loading,
    onRename,
    onMove,
    onCopy,
    onShare,
    onDelete,
    isSuperUser = false,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    folders: Folder[];
    fields: Field[];
    loading: boolean;
    onRename?: (field: Field) => void;
    onMove?: (field: Field) => void;
    onCopy?: (field: Field) => void;
    onShare?: (field: Field) => void;
    onDelete?: (field: Field) => void;
    isSuperUser?: boolean;
    t: (key: string) => string;
}) => {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [selectedFieldMenu, setSelectedFieldMenu] = useState<string | null>(null);

    const toggleFolder = (folderId: string) => {
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId);
        } else {
            newExpanded.add(folderId);
        }
        setExpandedFolders(newExpanded);
    };

    const getFieldsForFolder = (folderId: string | null) => {
        if (!folderId) {
            return fields.filter(f => !f.folderId);
        }
        return fields.filter(f => String(f.folderId) === String(folderId));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-75 p-4">
            <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-lg bg-gray-800 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-700 bg-gray-900 px-6 py-4">
                    <h2 className="text-2xl font-bold text-white">
                        {t('view_projects') || 'ดูโครงการ'} - {user.name}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 transition-colors hover:text-white"
                    >
                        <FaTimes className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 120px)' }}>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                            <span className="ml-3 text-gray-400">{t('loading') || 'กำลังโหลด...'}</span>
                        </div>
                    ) : folders.length === 0 && fields.length === 0 ? (
                        <div className="py-12 text-center text-gray-400">
                            <p>{t('no_projects_found') || 'ไม่พบโครงการ'}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Folders */}
                            {folders.map((folder) => {
                                const folderFields = getFieldsForFolder(folder.id);
                                const isExpanded = expandedFolders.has(folder.id);

                                return (
                                    <div key={folder.id} className="rounded-lg border border-gray-700 bg-gray-800/50">
                                        {/* Folder Header */}
                                        <button
                                            onClick={() => toggleFolder(folder.id)}
                                            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-700/50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <FaFolder className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                <span className="font-semibold text-white">{folder.name}</span>
                                                <span className="rounded-full bg-gray-700 px-2 py-1 text-xs text-gray-300">
                                                    {folderFields.length} {t('fields') || 'แปลง'}
                                                </span>
                                            </div>
                                            <FaFolderOpen className="h-4 w-4 text-gray-400" />
                                        </button>

                                        {/* Folder Fields */}
                                        {isExpanded && folderFields.length > 0 && (
                                            <div className="border-t border-gray-700 p-4">
                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                                    {folderFields.map((field) => (
                                                        <UserFieldCard
                                                            key={field.id}
                                                            field={field}
                                                            onMenuToggle={(fieldId) => {
                                                                setSelectedFieldMenu(selectedFieldMenu === fieldId ? null : fieldId);
                                                            }}
                                                            showMenu={selectedFieldMenu === field.id}
                                                            onRename={onRename}
                                                            onMove={onMove}
                                                            onCopy={onCopy}
                                                            onShare={onShare}
                                                            onDelete={onDelete}
                                                            isSuperUser={isSuperUser}
                                                            t={t}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Unassigned Fields */}
                            {(() => {
                                const unassignedFields = getFieldsForFolder(null);
                                if (unassignedFields.length === 0) return null;

                                return (
                                    <div className="rounded-lg border border-gray-700 bg-gray-800/50">
                                        <div className="p-4">
                                            <h3 className="mb-4 font-semibold text-white">
                                                {t('uncategorized_fields') || 'แปลงที่ยังไม่ได้จัดหมวดหมู่'} ({unassignedFields.length})
                                            </h3>
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                                {unassignedFields.map((field) => (
                                                    <UserFieldCard
                                                        key={field.id}
                                                        field={field}
                                                        onMenuToggle={(fieldId) => {
                                                            setSelectedFieldMenu(selectedFieldMenu === fieldId ? null : fieldId);
                                                        }}
                                                        showMenu={selectedFieldMenu === field.id}
                                                        onRename={onRename}
                                                        onMove={onMove}
                                                        onCopy={onCopy}
                                                        onShare={onShare}
                                                        onDelete={onDelete}
                                                        isSuperUser={isSuperUser}
                                                        t={t}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// User Field Card Component (simplified version for modal)
const UserFieldCard = ({
    field,
    onMenuToggle,
    showMenu,
    onRename,
    onMove,
    onCopy,
    onShare,
    onDelete,
    isSuperUser = false,
    t,
}: {
    field: Field;
    onMenuToggle: (fieldId: string) => void;
    showMenu: boolean;
    onRename?: (field: Field) => void;
    onMove?: (field: Field) => void;
    onCopy?: (field: Field) => void;
    onShare?: (field: Field) => void;
    onDelete?: (field: Field) => void;
    isSuperUser?: boolean;
    t: (key: string) => string;
}) => {
    const isFinished = field.status === 'finished' || field.isCompleted;

    return (
        <div className="group relative overflow-hidden rounded-lg border border-gray-700 bg-gray-800 p-4 transition-all duration-200 hover:border-blue-500 hover:bg-blue-900/10">
            {/* Field Header */}
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{field.category === 'horticulture' ? '🌳' : field.category === 'home-garden' ? '🏡' : field.category === 'greenhouse' ? '🌱' : '📁'}</span>
                    <h3 className="font-semibold text-white">{field.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                    {/* Status Badge */}
                    <button
                        className={`rounded-full px-2 py-1 text-xs font-medium ${isFinished
                            ? 'bg-green-600 text-white'
                            : 'bg-yellow-600 text-white'
                        }`}
                        title={isFinished ? t('finished') || 'เสร็จสิ้น' : t('unfinished') || 'ยังไม่เสร็จสิ้น'}
                    >
                        {isFinished ? '✅' : '⏳'}
                    </button>

                    {/* Three Dots Menu */}
                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onMenuToggle(field.id);
                            }}
                            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
                        >
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                            </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {showMenu && (
                            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-lg">
                                {onRename && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMenuToggle('');
                                            onRename(field);
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        {t('rename_project') || 'เปลี่ยนชื่อโครงการ'}
                                    </button>
                                )}
                                {onMove && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMenuToggle('');
                                            onMove(field);
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                        {t('move_project') || 'ย้ายโครงการ'}
                                    </button>
                                )}
                                {onCopy && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMenuToggle('');
                                            onCopy(field);
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        {t('copy_project') || 'คัดลอกโครงการ'}
                                    </button>
                                )}
                                {onShare && isSuperUser && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMenuToggle('');
                                            onShare(field);
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                        </svg>
                                        {t('share_to_user') || 'แชร์ไปยังผู้คน'}
                                    </button>
                                )}
                                {onDelete && (
                                    <>
                                        <hr className="my-1 border-gray-700" />
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onMenuToggle('');
                                                onDelete(field);
                                            }}
                                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-900/20 hover:text-red-300"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            {t('delete_project') || 'ลบโครงการ'}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Field Details */}
            <div className="space-y-1 text-sm text-gray-300">
                {field.category === 'horticulture' && (() => {
                    const data = field.projectData || field.project_data;
                    if (!data) return null;
                    let parsedData = data;
                    if (typeof data === 'string') {
                        try {
                            parsedData = JSON.parse(data);
                        } catch (e) {
                            return null;
                        }
                    }
                    if (!parsedData?.mainArea || parsedData.mainArea.length === 0) return null;
                    return (
                        <div className="mb-2">
                            <HorticultureMapPreview
                                fieldId={field.id}
                                projectData={parsedData}
                                height="120px"
                            />
                        </div>
                    );
                })()}

                <div className="flex justify-between">
                    <span>{t('plant_name') || 'ชื่อพืช'}:</span>
                    <span className="text-white">
                        {(() => {
                            const projectData = field.projectData || field.project_data;
                            if (projectData?.selectedPlantType?.name) {
                                return projectData.selectedPlantType.name;
                            }
                            return field.plantType?.name || 'N/A';
                        })()}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span>{t('area_label') || 'พื้นที่'}:</span>
                    <span className="text-white">
                        {field.totalArea != null
                            ? typeof field.totalArea === 'number'
                                ? field.totalArea.toFixed(2)
                                : (parseFloat(String(field.totalArea)) || 0).toFixed(2)
                            : 'N/A'}{' '}
                        {t('rai') || 'ไร่'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span>{t('quantity') || 'จำนวน'}:</span>
                    <span className="text-white">
                        {field.totalPlants != null ? field.totalPlants : 'N/A'} {t('plants_unit') || 'ต้น'}
                    </span>
                </div>
                {field.total_water_need != null && (
                    <div className="flex justify-between">
                        <span>{t('water_need') || 'ความต้องการน้ำ'}:</span>
                        <span className="text-white">
                            {typeof field.total_water_need === 'number'
                                ? field.total_water_need.toFixed(2)
                                : (parseFloat(String(field.total_water_need)) || 0).toFixed(2)}{' '}
                            {t('liters_per_session') || 'ลิตร/ครั้ง'}
                        </span>
                    </div>
                )}
                {isFinished && (() => {
                    const projectStats = field.project_stats;
                    if (!projectStats) return null;
                    const stats = typeof projectStats === 'string' ? JSON.parse(projectStats) : projectStats;
                    const costNumber = Number(stats.totalCost);
                    if (stats.totalCost == null || isNaN(costNumber) || costNumber < 0.01) return null;
                    return (
                        <div className="mt-2 flex justify-between border-t border-gray-600 pt-2">
                            <span className="font-semibold text-yellow-400">💰 {t('total_cost') || 'ราคารวมสุทธิ'}:</span>
                            <span className="font-bold text-yellow-300">
                                {costNumber.toLocaleString('th-TH', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                }) + ' ' + (t('baht') || 'บาท')}
                            </span>
                        </div>
                    );
                })()}
            </div>

            <div className="mt-2 text-xs text-gray-400">
                <span>{t('last_saved') || 'บันทึกล่าสุด'}: {new Date(field.created_at || field.createdAt || Date.now()).toLocaleDateString()}</span>
            </div>
        </div>
    );
};

// Rename Project Modal
const RenameProjectModal = ({
    isOpen,
    onClose,
    onRename,
    currentName,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onRename: (newName: string) => void;
    currentName: string;
    t: (key: string) => string;
}) => {
    const [newName, setNewName] = useState(currentName);
    
    useEffect(() => {
        if (isOpen) {
            setNewName(currentName);
        }
    }, [isOpen, currentName]);
    
    const handleSubmit = () => {
        if (newName.trim()) {
            onRename(newName.trim());
            onClose();
        }
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative z-[10000] w-full max-w-md rounded-lg bg-gray-800 p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">{t('rename_project')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div className="mb-6">
                    <label className="mb-2 block text-sm font-medium text-gray-300">
                        {t('project_name')}
                    </label>
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSubmit();
                            }
                        }}
                        className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                        placeholder={t('enter_new_project_name')}
                        autoFocus
                    />
                </div>
                
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!newName.trim()}
                        className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {t('save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Share To User Modal
const ShareToUserModal = ({
    isOpen,
    onClose,
    onSelectUser,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSelectUser: (user: any) => void;
    t: (key: string) => string;
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        if (!isOpen || searchQuery.length < 2) {
            setUsers([]);
            return;
        }
        
        const searchUsers = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
                setUsers(response.data.users || []);
            } catch (error) {
                console.error('Error searching users:', error);
                setUsers([]);
            } finally {
                setLoading(false);
            }
        };
        
        const debounce = setTimeout(searchUsers, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery, isOpen]);
    
    const handleClose = () => {
        onClose();
        setSearchQuery('');
        setUsers([]);
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative z-[10000] max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-gray-800 p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">{t('share_to_user')}</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div className="mb-4">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                        placeholder={t('search_by_name_email_phone')}
                        autoFocus
                    />
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-4">
                    {loading ? (
                        <div className="py-8 text-center text-gray-400">
                            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                            {t('loading')}...
                        </div>
                    ) : searchQuery.length < 2 ? (
                        <p className="py-8 text-center text-gray-400">{t('search_by_name_email_phone')}</p>
                    ) : users.length === 0 ? (
                        <p className="py-8 text-center text-gray-400">{t('no_users_found')}</p>
                    ) : (
                        <div className="space-y-2">
                            {users.map((user) => (
                                <button
                                    key={user.id}
                                    onClick={() => {
                                        onSelectUser(user);
                                    }}
                                    className="flex w-full items-center gap-3 rounded-lg border border-gray-700 bg-gray-800 p-3 text-left transition-colors hover:border-blue-500 hover:bg-blue-900/10"
                                >
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                                        {user.name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-white">{user.name}</h3>
                                        <p className="text-sm text-gray-400">{user.email}</p>
                                        {user.phone && <p className="text-xs text-gray-500">{user.phone}</p>}
                                    </div>
                                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleClose}
                        className="rounded bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600"
                    >
                        {t('cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Folder Selection Modal for Move/Copy/Share
const FolderSelectionModal = ({
    isOpen,
    onClose,
    onSelect,
    action,
    currentFolderId,
    folders,
    showAllFolders = false,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (folderId: string | null) => void;
    action: 'move' | 'copy' | 'share';
    currentFolderId?: string | null;
    folders: Folder[];
    showAllFolders?: boolean;
    t: (key: string) => string;
}) => {
    const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
    const [folderHistory, setFolderHistory] = useState<Folder[]>([]);
    
    const handleFolderClick = (folder: Folder) => {
        if (showAllFolders) {
            return;
        }
        
        if (folderHistory.some(f => f.id === folder.id)) {
            const existingIndex = folderHistory.findIndex(f => f.id === folder.id);
            const newHistory = folderHistory.slice(0, existingIndex + 1);
            setFolderHistory(newHistory);
            setSelectedFolder(folder);
            return;
        }
        
        setFolderHistory([...folderHistory, folder]);
        setSelectedFolder(folder);
    };
    
    const handleGoBack = () => {
        if (folderHistory.length > 0) {
            const newHistory = [...folderHistory];
            newHistory.pop();
            const parentFolder = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;
            setSelectedFolder(parentFolder);
            setFolderHistory(newHistory);
        }
    };
    
    const handleSelectHere = (folderToSelect?: Folder | null) => {
        const folder = folderToSelect || selectedFolder;
        onSelect(folder?.id || null);
        onClose();
        setSelectedFolder(null);
        setFolderHistory([]);
    };
    
    const getCurrentFolders = () => {
        let result;
        
        if (showAllFolders) {
            result = folders;
        } else {
            if (!selectedFolder) {
                result = folders.filter(f => !f.parent_id);
            } else {
                result = folders.filter(f => f.parent_id === selectedFolder.id);
            }
        }
        
        const uniqueFolders = result.filter((folder, index, self) => 
            index === self.findIndex(f => f.id === folder.id)
        );
        
        return uniqueFolders;
    };
    
    const handleClose = () => {
        onClose();
        setSelectedFolder(null);
        setFolderHistory([]);
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative z-[10000] max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-gray-800 p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">
                        {action === 'move' ? t('move_project') : action === 'share' ? t('share_to_user') : t('copy_project')}
                    </h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                {!showAllFolders && (
                    <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
                        <button
                            onClick={() => {
                                setSelectedFolder(null);
                                setFolderHistory([]);
                            }}
                            className="hover:text-white"
                        >
                            {t('all_folders')}
                        </button>
                        {folderHistory.map((folder, index) => (
                            <React.Fragment key={`breadcrumb-${folder.id}-${index}`}>
                                <span>/</span>
                                <button
                                    onClick={() => {
                                        const newHistory = folderHistory.slice(0, index + 1);
                                        setFolderHistory(newHistory);
                                        setSelectedFolder(folder);
                                    }}
                                    className="hover:text-white"
                                >
                                    {folder.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>
                )}
                
                <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-4">
                    {getCurrentFolders().length === 0 ? (
                        <p className="py-8 text-center text-gray-400">{t('no_folders_yet')}</p>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {getCurrentFolders().map((folder, index) => (
                                <button
                                    key={`folder-${folder.id}-${index}`}
                                    onClick={() => {
                                        if (showAllFolders) {
                                            handleSelectHere(folder);
                                        } else {
                                            handleFolderClick(folder);
                                        }
                                    }}
                                    onDoubleClick={() => {
                                        if (!showAllFolders && folder.id !== currentFolderId) {
                                            handleSelectHere(folder);
                                        }
                                    }}
                                    disabled={folder.id === currentFolderId}
                                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                                        folder.id === currentFolderId
                                            ? 'cursor-not-allowed border-gray-600 bg-gray-800 opacity-50'
                                            : showAllFolders
                                            ? 'border-gray-700 bg-gray-800 hover:border-blue-500 hover:bg-blue-900/10 cursor-pointer'
                                            : 'border-gray-700 bg-gray-800 hover:border-blue-500 hover:bg-blue-900/10'
                                    }`}
                                >
                                    <span className="text-2xl">
                                        {folder.icon || '📂'}
                                    </span>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-white">{folder.name}</h3>
                                        <p className="text-xs text-gray-400">
                                            {showAllFolders && folder.parent_id ? (
                                                <>
                                                    {t('parent_folder')}: {folders.find(f => f.id === folder.parent_id)?.name || 'N/A'}
                                                </>
                                            ) : (
                                                <>
                                                    {folders.filter(f => f.parent_id === folder.id).length} {t('sub_folders')}
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    {!showAllFolders && (
                                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    )}
                                    {showAllFolders && (
                                        <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="mt-6 flex items-center justify-between gap-3">
                    {!showAllFolders && folderHistory.length > 0 && (
                        <button
                            onClick={handleGoBack}
                            className="flex items-center gap-2 rounded bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            {t('back')}
                        </button>
                    )}
                    <div className="flex-1" />
                    <button
                        onClick={handleClose}
                        className="rounded bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={() => {
                            handleSelectHere();
                        }}
                        className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                    >
                        {action === 'move' ? t('move_here') : t('copy_here')}
                    </button>
                </div>
            </div>
        </div>
    );
};
