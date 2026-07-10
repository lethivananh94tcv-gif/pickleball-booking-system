/// <reference types="jest" />
jest.spyOn(console, "warn").mockImplementation(() => { });
jest.spyOn(console, "error").mockImplementation(() => { });