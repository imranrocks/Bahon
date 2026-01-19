import { db } from "../firebaseConfig"; // আপনার ফায়ারবেস কনফিগ ফাইল
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export const saveFuelLogWithMirror = async (userId: string, logData: any) => {
  try {
    // ১. ইউজারের কালেকশনে সেভ (যেটি ইউজার ডিলিট করতে পারবে)
    const userLogRef = collection(db, "users", userId, "logs");
    await addDoc(userLogRef, logData);

    // ২. আপনার মাস্টার কালেকশনে মিরর কপি (যেটি ইউজার ডিলিট করতে পারবে না)
    const masterLogRef = collection(db, "master_fuel_logs");
    await addDoc(masterLogRef, {
      ...logData,
      originalUserId: userId,
      mirrorTimestamp: serverTimestamp(), // সার্ভার টাইম
      status: "active"
    });

    console.log("Data mirrored successfully!");
  } catch (error) {
    console.error("Error mirroring data:", error);
    throw error;
  }
};