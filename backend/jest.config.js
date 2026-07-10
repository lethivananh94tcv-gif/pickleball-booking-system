module.exports = {
    testEnvironment: "node",
    roots: ["<rootDir>/src"],
    testMatch: ["**/__tests__/**/*.spec.ts", "**/*.spec.ts"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: {
                    module: "CommonJS",
                    moduleResolution: "node",
                    esModuleInterop: true,
                    jsx: "react-jsx",
                    // strict:false đã bị XÓA.
                    // Thay bằng types:['jest','node'] để ts-jest nhận đúng @types/jest
                    // mà không cần hạ thấp TypeScript strict mode.
                    // Production tsconfig.json vẫn giữ strict:true độc lập.
                    types: ["jest", "node"],
                    strictNullChecks: true
                }
            }
        ]
    },
    clearMocks: true
};
