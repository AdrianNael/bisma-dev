/**
 * Role-based Authorization Middleware
 * Use this to protect sensitive routes by checking user roles
 */

/**
 * Middleware to check if user has required role(s)
 * @param {string|string[]} allowedRoles - Role or array of roles allowed to access the route
 */
export const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        try {
            // Check if user is authenticated (should be set by authMiddleware)
            if (!req.user) {
                return res.status(401).json({
                    status: 401,
                    success: false,
                    message: 'Autentikasi diperlukan',
                });
            }

            // Get user role from JWT payload
            const userRole = req.user.role;

            if (!userRole) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'Role pengguna tidak ditemukan',
                });
            }

            // Convert to array if single role provided
            const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

            // Check if user role is in allowed roles
            if (!roles.includes(userRole)) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'Anda tidak memiliki akses untuk operasi ini',
                });
            }

            next();
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Terjadi kesalahan saat memverifikasi otorisasi',
            });
        }
    };
};

/**
 * Middleware to check if user is accessing their own resource or is admin
 * @param {string} userIdParam - The param name containing the user ID to check against
 */
export const requireOwnerOrAdmin = (userIdParam = 'userId') => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    status: 401,
                    success: false,
                    message: 'Autentikasi diperlukan',
                });
            }

            const resourceUserId = req.params[userIdParam] || req.query[userIdParam] || req.body[userIdParam];
            const currentUserId = req.user.id;
            const userRole = req.user.role;

            // Allow if admin/manager/dirmawa or if accessing own resource
            if (userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'DIRMAWA' || String(resourceUserId) === String(currentUserId)) {
                next();
            } else {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'Anda tidak memiliki akses untuk resource ini',
                });
            }
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Terjadi kesalahan saat memverifikasi otorisasi',
            });
        }
    };
};

// Role constants for consistency
export const ROLES = {
    MANAGER: 'MANAGER',
    DIRMAWA: 'DIRMAWA',
    STAF: 'STAF',
    MAHASISWA: 'MAHASISWA',
    ADMIN: 'ADMIN',
};
