// Authentication Manager
class AuthManager {
    constructor() {
        this.db = binanceDB;
        this.currentUser = null;
        this.init();
    }

    init() {
        this.currentUser = this.db.getCurrentUser();
        if (this.currentUser && window.location.pathname.includes('login.html')) {
            window.location.href = 'index.html';
        } else if (!this.currentUser && !window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
    }

    login(email, password) {
        const userId = this.db.authenticateUser(email, password);
        if (userId) {
            this.currentUser = this.db.getUser(userId);
            return true;
        }
        return false;
    }

    register(email, password) {
        if (!email || !password) return false;
        const userId = this.db.createUser(email, password);
        this.currentUser = this.db.getUser(userId);
        return true;
    }

    logout() {
        this.db.logout();
        this.currentUser = null;
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    getUser() {
        return this.currentUser;
    }

    getUserId() {
        return this.currentUser ? this.currentUser.id : null;
    }
}

// Global auth instance
const auth = new AuthManager();
