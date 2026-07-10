import bcrypt from "bcryptjs";
import * as authRepo from "../auth.repository";
import { login, me, register, verifyRegisterOtp } from "../auth.service";
import { compareOtp, generateOtp, hashOtp } from "@/utils/otp";
import { sendOtpEmail } from "@/utils/mail";
import { signAccessToken } from "@/utils/jwt";

jest.mock("bcryptjs", () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
    compare: jest.fn(),
  },
}));

jest.mock("../auth.repository", () => ({
  findUserByEmail: jest.fn(),
  findUserByPhoneNumber: jest.fn(),
  findRolesByUserId: jest.fn(),
  createPendingRegister: jest.fn(),
  findLatestPendingRegister: jest.fn(),
  increasePendingRegisterAttempts: jest.fn(),
  deletePendingRegisterByEmail: jest.fn(),
  createPlayerAccount: jest.fn(),
  increaseFailedLogin: jest.fn(),
  resetFailedLogin: jest.fn(),
  findUserById: jest.fn(),
}));

jest.mock("@/utils/otp", () => ({
  generateOtp: jest.fn(),
  hashOtp: jest.fn(),
  compareOtp: jest.fn(),
}));

jest.mock("@/utils/mail", () => ({
  sendOtpEmail: jest.fn(),
}));

jest.mock("@/utils/jwt", () => ({
  signAccessToken: jest.fn(),
}));

const mockedRepo = jest.mocked(authRepo);
const mockedBcrypt = jest.mocked(bcrypt);

describe("auth.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    const input = {
      fullName: "Nguyen Van A",
      email: "player@example.com",
      phoneNumber: "0912345678",
      password: "Password123",
      gender: "Male" as "Male" | "Female" | "Other" | undefined,
      dateOfBirth: "2000-01-01",
      address: "HCM",
    };

    it("creates a pending register and sends OTP when email and phone are new", async () => {
      mockedRepo.findUserByEmail.mockResolvedValue(null as any);
      mockedRepo.findUserByPhoneNumber.mockResolvedValue(null as any);
      mockedBcrypt.hash.mockResolvedValue("hashed-password" as never);
      jest.mocked(generateOtp).mockReturnValue("123456");
      jest.mocked(hashOtp).mockResolvedValue("hashed-otp");

      const result = await register(input);

      expect(result.email).toBe(input.email);
      expect(mockedRepo.deletePendingRegisterByEmail).toHaveBeenCalledWith(input.email);
      expect(mockedRepo.createPendingRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          email: input.email,
          passwordHash: "hashed-password",
          otpHash: "hashed-otp",
        })
      );
      expect(sendOtpEmail).toHaveBeenCalledWith(input.email, "123456");
    });

    it("rejects registration when email already exists", async () => {
      mockedRepo.findUserByEmail.mockResolvedValue({ UserID: 1 } as any);

      await expect(register(input)).rejects.toThrow("Email already exists");
      expect(mockedRepo.createPendingRegister).not.toHaveBeenCalled();
    });
  });

  describe("verifyRegisterOtp", () => {
    it("creates player account when OTP is valid", async () => {
      mockedRepo.findLatestPendingRegister.mockResolvedValue({
        PendingID: 1,
        FullName: "Nguyen Van A",
        Email: "player@example.com",
        PhoneNumber: "0912345678",
        PasswordHash: "hashed-password",
        Gender: null,
        DateOfBirth: null,
        Address: null,
        OtpHash: "hashed-otp",
        Attempts: 0,
      } as any);
      jest.mocked(compareOtp).mockResolvedValue(true);

      const result = await verifyRegisterOtp({
        email: "player@example.com",
        otp: "123456",
      });

      expect(result.message).toEqual(expect.any(String));
      expect(mockedRepo.createPlayerAccount).toHaveBeenCalled();
      expect(mockedRepo.deletePendingRegisterByEmail).toHaveBeenCalledWith("player@example.com");
    });

    it("increases attempt count when OTP is invalid", async () => {
      mockedRepo.findLatestPendingRegister.mockResolvedValue({
        PendingID: 1,
        OtpHash: "hashed-otp",
        Attempts: 0,
      } as any);
      jest.mocked(compareOtp).mockResolvedValue(false);

      await expect(
        verifyRegisterOtp({ email: "player@example.com", otp: "000000" })
      ).rejects.toThrow();
      expect(mockedRepo.increasePendingRegisterAttempts).toHaveBeenCalledWith(1);
    });
  });

  describe("login", () => {
    const activeUser = {
      UserID: 7,
      FullName: "Player A",
      Email: "player@example.com",
      PhoneNumber: "0912345678",
      AvatarURL: null,
      Gender: null,
      DateOfBirth: null,
      Address: null,
      Status: "Active",
      LockedUntil: null,
      PasswordHash: "hashed-password",
    };

    it("returns token and user info when credentials are valid", async () => {
      mockedRepo.findUserByEmail.mockResolvedValue(activeUser as any);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedRepo.findRolesByUserId.mockResolvedValue(["Player"]);
      jest.mocked(signAccessToken).mockReturnValue("access-token");

      const result = await login({
        email: "player@example.com",
        password: "Password123",
      });

      expect(result.token).toBe("access-token");
      expect(result.user.roles).toEqual(["Player"]);
      expect(mockedRepo.resetFailedLogin).toHaveBeenCalledWith(7);
    });

    it("rejects login and increases failed count when password is wrong", async () => {
      mockedRepo.findUserByEmail.mockResolvedValue(activeUser as any);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        login({ email: "player@example.com", password: "wrong" })
      ).rejects.toThrow("Invalid email or password");
      expect(mockedRepo.increaseFailedLogin).toHaveBeenCalledWith("player@example.com");
    });

    it("rejects locked accounts", async () => {
      mockedRepo.findUserByEmail.mockResolvedValue({
        ...activeUser,
        Status: "Locked",
      } as any);

      await expect(
        login({ email: "player@example.com", password: "Password123" })
      ).rejects.toThrow("Account is locked");
    });
  });

  describe("me", () => {
    it("returns profile with roles", async () => {
      mockedRepo.findUserById.mockResolvedValue({
        UserID: 7,
        FullName: "Player A",
        Email: "player@example.com",
        PhoneNumber: "0912345678",
        AvatarURL: null,
        Gender: null,
        DateOfBirth: null,
        Address: null,
        Status: "Active",
      } as any);
      mockedRepo.findRolesByUserId.mockResolvedValue(["Player"]);

      const result = await me(7);

      expect(result.userId).toBe(7);
      expect(result.roles).toEqual(["Player"]);
    });
  });
});
