"use server";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { signIn } from "@/auth";
import Account from "@/database/account.model";
import User from "@/database/user.model";

import action from "../handlers/action";
import handleError from "../handlers/error";
import { SignUpSchema } from "../validations";

export async function signUpWithCredentials(
  params: AuthCredentials
): Promise<ActionResponse> {
  const validationResult = await action({ params, schema: SignUpSchema });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { name, username, email, password } = validationResult.params!;

  const session = await mongoose.startSession();
  session.startTransaction();

  let transactionCommited = false;

  try {
    const existingUser = await User.findOne({ email }).session(session);
    console.log("🚀 ~ existingUser:", existingUser);

    if (existingUser) {
      throw new Error("User already exists");
    }

    const existingUsername = await User.findOne({ username }).session(session);

    if (existingUsername) {
      throw new Error("Username already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [newUser] = await User.create([{ username, name, email }], {
      session,
    });

    await Account.create(
      [
        {
          userId: newUser._id,
          name,
          provider: "credentials",
          providerAccountId: email,
          password: hashedPassword,
        },
      ],
      { session }
    );

    try {
      await session.commitTransaction();
      transactionCommited = true;

      await signIn("credentials", { email, password, redirect: false });
      return { success: true };
      
    } catch (error) {
      if (!transactionCommited) await session.abortTransaction();

      return handleError(error) as ErrorResponse;
    }
  } catch (error) {
    // Only attempt to abort the transaction if it hasn't been committed

    if (!transactionCommited) await session.abortTransaction();

    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
}
