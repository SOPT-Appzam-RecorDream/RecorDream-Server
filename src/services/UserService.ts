import mongoose from "mongoose";
import { FcmTokenUpdateDto } from "../interfaces/user/FcmTokenUpdateDto";
import { UserNicknameUpdateDto } from "../interfaces/user/UserNicknameUpdateDto";
import { UserResponseDto } from "../interfaces/user/UserResponseDto";
import { PostBaseResponseDto } from "../interfaces/common/PostBaseResponseDto";
import User from "../models/User";
import userMocking from "../models/UserMocking";
import Notice from "../models/Notice";
import pushMessage from "../modules/pushMessage";
import * as admin from "firebase-admin";
import schedule from "node-schedule";
import { UserNoticePostDto } from "../interfaces/user/UserNoticePostDto";
import Agenda from "agenda";
import config from "../config";

// agenda setting
const agenda = new Agenda({
  db: { address: config.mongoURI },
});

const updateNickname = async (userId: string, userNicknameUpdateDto: UserNicknameUpdateDto) => {
  try {
    const updatedNickname = {
      nickname: userNicknameUpdateDto.nickname,
    };

    const user = await User.findByIdAndUpdate(userId, updatedNickname);

    if (!user) {
      return null;
    }
  } catch (err) {
    console.log(err);
    throw err;
  }
};

const getUser = async (userId: string, fcm_token: string) => {
  try {
    const userObjectId: mongoose.Types.ObjectId = userMocking[parseInt(userId) - 1];
    const user: UserResponseDto | null = await User.findById(userObjectId);

    const device = await Notice.find({ fcm_token: fcm_token });

    if (!user || !device[0]) {
      return null;
    }

    // 조회할 회원정보가 있고
    // is_active가 false 일 때
    //if (device[0].is_active == false) {
    //device[0].time = null;
    //}
    const result = {
      nickname: user.nickname,
      email: user.email,
      is_active: device[0].isActive,
      time: device[0].time,
      is_deleted: user.is_deleted,
    };
    return result;
  } catch (err) {
    console.log(err);
    throw err;
  }
};

// fcm_token: req.body -> 즉, 유저의 fcm token을 하나하나 업데이트 (fcm token이 여러 개면 여러번 해야함)
const updateFcmToken = async (userId: string, fcmTokenUpdateDto: FcmTokenUpdateDto) => {
  const userObjectId: mongoose.Types.ObjectId = userMocking[parseInt(userId) - 1];

  try {
    const user = await User.findById(userObjectId);

    if (!user) {
      return null;
    }

    const tokens = {
      fcm_token: fcmTokenUpdateDto.fcm_token,
      new_token: fcmTokenUpdateDto.new_token,
    };

    if (user.fcmTokens[0] !== tokens.fcm_token && user.fcmTokens[1] !== tokens.fcm_token) {
      return null;
    }

    if (user.fcmTokens[0] === tokens.fcm_token) {
      await User.updateOne({ fcm_token: tokens.fcm_token }, { "fcm_token.$": tokens.new_token }).exec();
    }
    if (user.fcmTokens[1] === tokens.fcm_token) {
      await User.updateOne({ fcm_token: tokens.fcm_token }, { "fcm_token.$": tokens.new_token }).exec();
    }
  } catch (err) {
    console.log(err);
    throw err;
  }
};

const deleteUser = async (userId: string) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      return null;
    }

    await User.deleteOne({ _id: userId });
  } catch (err) {
    console.log(err);
    throw err;
  }
};

const postNotice = async (noticePostDto: UserNoticePostDto): Promise<PostBaseResponseDto | null | undefined> => {
  try {
    const user = await User.findById(noticePostDto.userId);

    if (!user) {
      return null;
    }

    // 기기별 입력한 푸시알림 시간 확인
    const time = noticePostDto.time;

    const timeSplit = time.split(/:| /);
    const ampm = timeSplit[0];

    let hour = parseInt(timeSplit[1]);
    const minute = timeSplit[2];

    let isDay = true; // AM, PM 판별
    if (ampm === "AM" || ampm === "am") isDay = true;
    if (ampm === "PM" || ampm === "pm") isDay = false;

    if (isDay === false && hour !== 12) hour += 12; // 오후
    if (isDay === true && hour === 12) hour = 0;

    // 푸시알림 설정
    const alarms = {
      android: {
        data: {
          title: pushMessage.title,
          body: pushMessage.body,
        },
      },
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
            alert: {
              title: pushMessage.title,
              body: pushMessage.body,
            },
          },
        },
      },
      tokens: user.fcmTokens,
    };

    agenda.define("pushAlarm", (job, done) => {
      admin
        .messaging()
        .sendMulticast(alarms)
        .then(function (res: any) {
          console.log("Successfully sent message: ", res);
        })
        .catch(function (err) {
          console.log("Error Sending message!!! : ", err);
        });
      job.repeatEvery("24 hours", {
        skipImmediate: true,
      });
      job.save();
      done();
    });

    agenda.schedule("everyday at " + hour + ":" + minute + "", "pushAlarm", null);
    agenda.start();

    await User.updateOne({ _id: noticePostDto.userId }, { $set: { time: time, isActive: true } });
  } catch (err) {
    console.log(err);
    throw err;
  }
};

export default {
  updateNickname,
  getUser,
  updateFcmToken,
  deleteUser,
  postNotice,
};
