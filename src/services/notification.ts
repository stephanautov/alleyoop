// src/services/notification.ts

export class NotificationService {
    private static instance: NotificationService;
    private permission: NotificationPermission = 'default';

    private constructor() {
        this.checkPermission();
    }

    static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    async checkPermission() {
        if ('Notification' in window) {
            this.permission = Notification.permission;
            if (this.permission === 'default') {
                // Don't request immediately, wait for user interaction
            }
        }
    }

    async requestPermission(): Promise<boolean> {
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            return permission === 'granted';
        } catch (error) {
            console.error('Failed to request notification permission:', error);
            return false;
        }
    }

    async showNotification(title: string, options?: NotificationOptions) {
        if (this.permission !== 'granted') {
            const granted = await this.requestPermission();
            if (!granted) return;
        }

        try {
            const notification = new Notification(title, {
                icon: '/icon-192x192.png',
                badge: '/icon-72x72.png',
                tag: 'docuforge-generation',
                ...options,
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            // Auto close after 5 seconds
            setTimeout(() => notification.close(), 5000);
        } catch (error) {
            console.error('Failed to show notification:', error);
        }
    }

    showDocumentComplete(documentTitle: string) {
        this.showNotification('Document Generated!', {
            body: `${documentTitle} has been generated successfully.`,
        });
    }

    showDocumentError(documentTitle: string) {
        this.showNotification('Generation Failed', {
            body: `Failed to generate ${documentTitle}. Click to retry.`,
        });
    }
}