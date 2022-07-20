import { Request, Response } from "express";
import { UserNicknameUpdateDto } from "../interfaces/user/UserNicknameUpdateDto";
import { validationResult } from "express-validator";
import message from "../modules/responseMessage";
import statusCode from "../modules/statusCode";
import util from "../modules/util";
import UserService from "../services/UserService";
import { FcmTokenUpdateDto } from "../interfaces/user/FcmTokenUpdateDto";
import { UserAlarmDto } from "../interfaces/user/UserAlarmDto";

/**
 * @route PUT /user/nickname
 * @desc Update User Nickname
 * @access Public
 */
const updateNickname = async (req: Request, res: Response): Promise<void> => {
  const err = validationResult(req);
  const userUpdateDto: UserNicknameUpdateDto = req.body;
  const userId = req.header("userId");

  try {
    if (!userId || !err.isEmpty()) {
      res.status(statusCode.BAD_REQUEST).send(util.fail(statusCode.BAD_REQUEST, message.UPDATE_NICKNAME_FAIL));
    }

    await UserService.updateNickname(userId as string, userUpdateDto);

    res.status(statusCode.OK).send(util.success(statusCode.OK, message.UPDATE_NICKNAME_SUCCESS));
  } catch (err) {
    console.log(err);
    res.status(statusCode.INTERNAL_SERVER_ERROR).send(util.fail(statusCode.INTERNAL_SERVER_ERROR, message.INTERNAL_SERVER_ERROR));
  }
};

/**
 * @route GET /user
 * @desc Get User
 * @access Public
 */
const getUser = async (req: Request, res: Response): Promise<void> => {
  const userId = req.header("userId");

  try {
    if (!userId) {
      res.status(statusCode.BAD_REQUEST).send(util.fail(statusCode.BAD_REQUEST, message.NULL_VALUE));
    }
    const data = await UserService.getUser(userId as string);

    res.status(statusCode.OK).send(util.success(statusCode.OK, message.READ_USER_SUCCESS, data));
  } catch (err) {
    console.log(err);
    res.status(statusCode.INTERNAL_SERVER_ERROR).send(util.fail(statusCode.INTERNAL_SERVER_ERROR, message.INTERNAL_SERVER_ERROR));
  }
};

/**
 * @route PUT /user/:toggle
 * @desc Push Alarm Toggle Change
 * @access Public
 */
const changeToggle = async (req: Request, res: Response): Promise<void> => {
  const userId = req.header("userId");
  const toggle: string = req.params.toggle;
  const userAlarmDto: UserAlarmDto = req.body;

  if (!userId) {
    res.status(statusCode.BAD_REQUEST).send(util.fail(statusCode.BAD_REQUEST, message.NULL_VALUE));
  }
  if (toggle !== "1" && toggle !== "0") {
    // toggle parameter 값은 1이나 0만 받음, 다른게 들어오면 404 처리
    res.status(statusCode.NOT_FOUND).send(util.fail(statusCode.NOT_FOUND, message.NOT_FOUND));
  }

  try {
    const result = await UserService.changeToggle(userId as string, toggle, userAlarmDto);
    if (result === null) {
      res.status(statusCode.NOT_FOUND).send(util.fail(statusCode.NOT_FOUND, message.NOT_FOUND_FCM));
    }

    res.status(statusCode.OK).send(util.success(statusCode.OK, message.CHANGE_TOGGLE_SUCCESS));
  } catch (err) {
    console.log(err);
    res.status(statusCode.INTERNAL_SERVER_ERROR).send(util.fail(statusCode.INTERNAL_SERVER_ERROR, message.INTERNAL_SERVER_ERROR));
  }
};

/**
 * @router PUT /user/:userId/fcm-token
 * @desc Refresh User's fcm token
 * @access Public
 */
const updateFcmToken = async (req: Request, res: Response) => {
  const fcmTokenUpdateDto: FcmTokenUpdateDto = req.body;
  const { userId } = req.params;

  try {
    const updatedToken = await UserService.updateFcmToken(userId, fcmTokenUpdateDto);

    if (!updatedToken) {
      return res.status(statusCode.NOT_FOUND).send(util.fail(statusCode.NOT_FOUND, message.NULL_VALUE));
    }

    res.status(statusCode.OK).send(util.success(statusCode.OK, message.UPDATE_FCM_TOKEN_SUCCESS));
  } catch (err) {
    console.log(err);
    res.status(statusCode.INTERNAL_SERVER_ERROR).send(util.fail(statusCode.INTERNAL_SERVER_ERROR, message.INTERNAL_SERVER_ERROR));
  }
};

export default {
  updateNickname,
  getUser,
  changeToggle,
  updateFcmToken,
};
