import { useEffect } from 'react';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { Dialog } from '@capacitor/dialog'; 
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

export const usePushNotifications = () => {
  useEffect(() => {
    
    // ১. অ্যান্ড্রয়েড নোটিফিকেশন চ্যানেল (সাউন্ড ও ভাইব্রেশন নিশ্চিত করতে)
    const initPush = async () => {
      if (Capacitor.getPlatform() !== 'web') {
        const result = await PushNotifications.requestPermissions();
        if (result.receive === 'granted') {
          await PushNotifications.register();
        }
      }

      if (Capacitor.getPlatform() === 'android') {
        await PushNotifications.createChannel({
          id: 'fcm_default_channel',
          name: 'Default',
          description: 'General Notifications',
          importance: 5,
          visibility: 1,
          vibration: true,
        });
      }
    };

    initPush();

    // ২. রেজিস্ট্রেশন ইভেন্ট লিসেনার (Debug করার জন্য রাখা ভালো)
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push Token:', token.value);
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push Error:', error);
    });

    // ৩. অ্যাপ চলাকালীন নেটিভ পুশ আসলে (FCM এর জন্য)
    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      await Dialog.alert({
        title: notification.title || "New Notification",
        message: notification.body || "",
      });
    });

    // ৪. ড্যাশবোর্ড থেকে রিয়েল-টাইম নোটিফিকেশন (Firestore)
    const q = query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          
          // পপ-আপ দেখানোর আগে চেক করুন যেন একদম নতুন মেসেজ হয়
          const now = Date.now();
          const postTime = data.createdAt?.toMillis ? data.createdAt.toMillis() : now;

          if (now - postTime < 30000) { // ৩০ সেকেন্ডের পুরনো হলে দেখাবে না
            await Dialog.alert({
              title: data.title || "Master Control",
              message: data.body || "You have a new update!",
              buttonName: "Okay"
            });
          }
        }
      });
    });

    // ৫. ক্লিনআপ (Cleanup)
    return () => {
      unsubscribeFirestore();
      PushNotifications.removeAllListeners();
    };
  }, []);
};