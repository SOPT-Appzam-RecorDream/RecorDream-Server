import axios from "axios";
import User from "../models/User";
import jwt from "jsonwebtoken";
import jwtHandler from "../modules/jwtHandler";
import { AuthResponseDto } from "../interfaces/auth/AuthResponseDto";
import exceptionMessage from "../modules/exceptionMessage";
import { AuthLogoutDto } from "../interfaces/auth/AuthLogoutDto";

const kakaoLogin = async (kakaoToken: string, fcmToken: string): Promise<AuthResponseDto | null | undefined> => {
  try {
    // 카카오 서버와 연결
    const response = await axios({
      method: "GET",
      url: "https://kapi.kakao.com/v2/user/me",
      headers: {
        Authorization: `Bearer ${kakaoToken}`, // 클라한테 받은 accessToken
      },
    });

    if (!response) {
      return null;
    }

    const userData = response.data.kakao_account;
    const email = userData.email;

    const existUser = await User.findOne({
      email: email,
    });

    // db에 유저가 없으면 회원 가입
    if (!existUser) {
      const nickname = userData.nickname;
      const gender = userData.gender;
      const age_range = userData.age_range;

      const user = new User({
        isAlreadyUser: false,
        nickname: nickname,
        email: email,
        gender: gender || null,
        age_range: age_range || null,
        fcmToken: fcmToken,
      });

      user.accessToken = jwtHandler.getAccessToken(user.id);
      user.refreshToken = jwtHandler.getRefreshToken();

      await user.save();

      const data: AuthResponseDto = {
        isAlreadyUser: user.isAlreadyUser,
        accessToken: user.accessToken,
        refreshToken: user.refreshToken,
        nickname: nickname,
      };

      return data;
    }

    // 유저가 있으면 로그인 처리
    existUser.accessToken = jwtHandler.getAccessToken(existUser._id);
    existUser.refreshToken = jwtHandler.getRefreshToken();
    existUser.isAlreadyUser = true;

    // 한 유저가 여러 기기로 로그한 경우
    if (!existUser.fcmToken.includes(fcmToken)) {
      existUser.fcmToken.push(fcmToken);
    }

    const data: AuthResponseDto = {
      isAlreadyUser: existUser.isAlreadyUser,
      accessToken: existUser.accessToken,
      refreshToken: existUser.refreshToken,
      nickname: existUser.nickname,
    };

    await User.findByIdAndUpdate(existUser._id, existUser);

    return data;
  } catch (err) {
    console.log(err);
    throw err;
  }
};

const appleLogin = async (appleToken: string, fcmToken: string): Promise<AuthResponseDto | null | undefined> => {
  try {
    if (!appleToken || !fcmToken) {
      return null;
    }

    // id_token 해독
    const appleUser = jwt.decode(appleToken);

    if (appleUser === null) {
      return null;
    }

    // appleUser.sub
    if (!(appleUser as jwt.JwtPayload).sub) {
      return null;
    }

    // 존재하는 유저인지 확인
    const existUser = await User.findOne({
      appleId: (appleUser as jwt.JwtPayload).sub,
    });

    // 출력해서 확인해 볼 것!
    let email = "";
    if ((appleUser as jwt.JwtPayload).email) {
      email = (appleUser as jwt.JwtPayload).email;
    }

    let nickname = "";
    if ((appleUser as jwt.JwtPayload).nickname) {
      nickname = (appleUser as jwt.JwtPayload).nickname;
    }

    // db에 유저가 없으면 회원 가입
    if (!existUser) {
      const user = new User({
        isAlreadyUser: false,
        appleId: (appleUser as jwt.JwtPayload).sub,
        email: email,
        nickname: nickname,
        fcmToken: fcmToken,
      });

      const jwtToken = jwtHandler.getAccessToken(user.id);
      user.accessToken = jwtToken;

      const refreshToken = jwtHandler.getRefreshToken();
      user.refreshToken = refreshToken;

      await user.save();

      const data: AuthResponseDto = {
        isAlreadyUser: user.isAlreadyUser,
        accessToken: user.accessToken,
        refreshToken: refreshToken,
        nickname: nickname,
      };

      return data;
    }

    // 유저가 있으면 로그인 처리
    const accessToken = jwtHandler.getAccessToken(existUser._id);
    const refreshToken = jwtHandler.getRefreshToken();
    existUser.isAlreadyUser = true;

    // 한 유저가 여러 기기로 로그한 경우
    if (!existUser.fcmToken.includes(fcmToken)) {
      existUser.fcmToken.push(fcmToken);
    }

    const data: AuthResponseDto = {
      isAlreadyUser: existUser.isAlreadyUser,
      accessToken: accessToken,
      refreshToken: refreshToken,
      nickname: nickname,
    };

    await User.findByIdAndUpdate(existUser._id, data);

    return data;
  } catch (err) {
    console.log(err);
    throw err;
  }
};

const reissueToken = async (accessToken: string, refreshToken: string) => {
  const decodedAc = jwtHandler.verifyToken(accessToken);
  const decodedRf = jwtHandler.verifyToken(refreshToken);
  const decoded = jwt.decode(accessToken);

  if (decodedAc === exceptionMessage.INVALID_TOKEN || decodedRf === exceptionMessage.INVALID_TOKEN) {
    return "invalid_token";
  }

  const userId = (decoded as any).user.id;
  const user = await User.findById(userId);

  if (refreshToken !== user?.refreshToken) {
    return "invalid_token";
  }

  // accessToken, refreshToken 둘 다 만료
  if (decodedAc == exceptionMessage.EXPIRED_TOKEN) {
    if (decodedRf == exceptionMessage.EXPIRED_TOKEN) {
      return "all_expired_token";
    }
    // accessToken은 만료, refreshToken은 만료 x -> accessToken 재발급
    const newToken = jwtHandler.getAccessToken(userId);

    const data = {
      accessToken: newToken,
      refreshToken,
    };

    await User.findByIdAndUpdate(user, data);

    return data;
  }

  // accessToken 만료 안 됨
  return "valid_token";
};

const socialLogout = async (authLogoutDto: AuthLogoutDto) => {
  try {
    const user = await User.findById(authLogoutDto.userId);

    if (!user) {
      return null;
    }

    const fcmToken = authLogoutDto.fcmToken;

    // fcmToken 안 넣었을 경우
    if (!fcmToken) {
      return null;
    }

    // 존재하지 않는 fcmToken일 경우
    if (!user.fcmToken.includes(fcmToken)) {
      return exceptionMessage.NOT_FOUND_FCM;
    }

    for (let i = 0; i < user.fcmToken.length; i++) {
      if (user.fcmToken[i] === fcmToken) {
        user.fcmToken.splice(i, 1);
        i--;
      }
    }

    const updatedfcmToken = user.fcmToken;

    await user.updateOne({ fcmToken: updatedfcmToken });

    return updatedfcmToken;
  } catch (err) {
    console.log(err);
    throw err;
  }
};

export default {
  kakaoLogin,
  appleLogin,
  reissueToken,
  socialLogout,
};
