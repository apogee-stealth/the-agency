# Unit Test Examples

Reference examples for the style guide in `.ai/UnitTestGeneration.md`. Each example demonstrates the conventions and critical rules described there.

---

## Example: SearchSessionRepository

```typescript
// SearchSessionRepository.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
const collectionMockFn = jest.fn();
const getMongoDb = jest.fn().mockResolvedValue({
    collection: collectionMockFn,
} as unknown as Db);
jest.mock("@apogee-travel/common-db", () => {
    return {
        getMongoDb,
    };
});
const mockObjectId = jest.fn();
jest.mock("mongodb", () => {
    const originalModule = jest.requireActual("mongodb");
    return {
        __esModule: true,
        ...originalModule,
        ObjectId: mockObjectId,
    };
});
const mockGetServicesFeatureFlagClient = jest.fn();
jest.mock("@apogee-travel/common-feature-flag", () => {
    return { getServicesFeatureFlagClient: mockGetServicesFeatureFlagClient };
});
const mockAsyncLockWithTelemetry = jest.fn();
jest.mock("../../messaging/handlers/common/asyncLockWithMetrics", () => {
    return {
        AsyncLockWithTelemetry: mockAsyncLockWithTelemetry,
    };
});
jest.mock("../SearchTelemetry/searchTelemetryApi", () => {
    return {
        traceEvent: jest.fn(),
    };
});
import { Collection, Db } from "mongodb";
import { mock_logger } from "@apogee-travel/common-test";
import { SearchSessionStatus } from "@apogee-travel/common-types";
let repoInstance: any;
describe("services > hotel-availability > data > SearchSessionRepository", () => {
    let fakeCollection: any,
        fakeMongoInventoryItemId: any,
        replaceOneResult: any,
        flagClient: any,
        findOneResult: any;
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        flagClient = {
            getNumberValue: jest.fn().mockResolvedValue(3600),
            addHandler: jest.fn(),
        };
        mockGetServicesFeatureFlagClient.mockResolvedValue(flagClient);
        mockObjectId.mockImplementation(() => {
            return {
                toHexString() {
                    return fakeMongoInventoryItemId;
                },
            };
        });
        replaceOneResult = {
            matchedCount: 1,
        };
        findOneResult = {
            _id: "MONGO_ID",
            asid: "a38c287c-15c3-42f0-863f-872af171982d",
            status: "COMPLETED",
            payload: {
                asid: "a38c287c-15c3-42f0-863f-872af171982d",
                stay: {
                    adults: 2,
                    children: 0,
                    rooms: 1,
                    checkIn: "2024-06-12",
                    checkOut: "2024-06-14",
                },
                place: {
                    coords: {
                        latitude: 28.5383832,
                        longitude: -81.3789269,
                    },
                    text: "Orlando, FL, USA",
                },
                radiusMiles: 20,
                pagination: {
                    offset: 0,
                },
            },
        };
        fakeCollection = {
            findOne: jest.fn().mockResolvedValue(findOneResult),
            replaceOne: jest.fn().mockResolvedValue(replaceOneResult),
            createIndex: jest.fn().mockResolvedValue(undefined),
            dropIndex: jest.fn().mockResolvedValue(undefined),
            updateOne: jest.fn().mockResolvedValue(undefined),
        };
        collectionMockFn.mockImplementation(
            (): Collection => fakeCollection as unknown as Collection
        );
    });
    describe("with getSearchSessionRepository", () => {
        describe("when the !MONGO_URL env var is missing", () => {
            let expectedErr any;
            beforeEach(async () => {
                try {
                    const mod = await import("./SearchSessionRepository");
                    await mod.getSearchSessionRepository();
                } catch (err) {
                    expectedErr = err;
                }
            });
            it("should throw an error", async () => {
                expect((expectedErr).toString()).toMatch(
                    "Search Session Service error: missing MONGO_URL env var value"
                );
            });
        });
        describe("when things go splendiferously", () => {
            beforeEach(async () => {
                const mod = await import("./SearchSessionRepository");
                process.env.MONGO_URL = "MONGO_URL";
                repoInstance = await mod.getSearchSessionRepository();
            });
            it("should call through to getMongoDb on the first call", () => {
                expect(getMongoDb).toHaveBeenCalledTimes(1);
                expect(getMongoDb).toHaveBeenCalledWith("MONGO_URL", "hotel_availability");
            });
            it("should drop the session doc index", () => {
                expect(fakeCollection.dropIndex).toHaveBeenCalledWith(
                    "search_session_doc_expiration"
                );
            });
            it("should create the expected indexes", () => {
                expect(fakeCollection.createIndex).toHaveBeenNthCalledWith(
                    1,
                    { asid: 1 },
                    { unique: true }
                );
                expect(fakeCollection.createIndex).toHaveBeenNthCalledWith(
                    2,
                    { updatedAt: 1 },
                    { expireAfterSeconds: 3600, name: "search_session_doc_expiration" }
                );
            });
        });
    });
    describe("with the SearchSessionRepository class", () => {
        beforeEach(async () => {
            process.env.MONGO_URL = "MONGO_URL";
            const mod = await import("./SearchSessionRepository");
            repoInstance = await mod.getSearchSessionRepository();
        });
        it("should initialize the instance collection", () => {
            expect(collectionMockFn).toHaveBeenCalledWith("search_sessions");
        });
        it("should assign collection to the repo instance", () => {
            expect(repoInstance.collection).toBeTruthy();
        });
        describe("when calling upsertSearchSession", () => {
            let upserted: any, upsertResult: any;
            beforeEach(async () => {
                upserted = {
                    asid: "a38c287c-15c3-42f0-863f-872af171982d",
                    status: "COMPLETED",
                    payload: {
                        asid: "a38c287c-15c3-42f0-863f-872af171982d",
                        stay: {
                            adults: 2,
                            children: 0,
                            rooms: 1,
                            checkIn: "2024-06-12",
                            checkOut: "2024-06-14",
                        },
                        place: {
                            coords: {
                                latitude: 28.5383832,
                                longitude: -81.3789269,
                            },
                            text: "Orlando, FL, USA",
                        },
                        radiusMiles: 20,
                        pagination: {
                            offset: 0,
                        },
                    },
                };
                const mod = await import("./SearchSessionRepository");
                repoInstance = await mod.getSearchSessionRepository();
                upsertResult = await repoInstance.upsertSearchSession(upserted);
            });
            it("should call replaceOne on the instance collection", () => {
                expect(fakeCollection.replaceOne).toHaveBeenCalledTimes(1);
                expect(fakeCollection.replaceOne).toHaveBeenCalledWith(
                    {
                        asid: upserted.asid,
                    },
                    upserted,
                    { upsert: true }
                );
            });
            it("should return the session data that was passed to upsertSearchSession", () => {
                expect(upsertResult).toEqual(upserted);
            });
        });
        describe("when calling getSearchSession", () => {
            let getSearchSessionResult: any;
            beforeEach(async () => {
                const mod = await import("./SearchSessionRepository");
                repoInstance = await mod.getSearchSessionRepository();
                getSearchSessionResult = await repoInstance.getSearchSession(
                    "a38c287c-15c3-42f0-863f-872af171982d"
                );
            });
            it("should call findOne on the collection", () => {
                expect(fakeCollection.findOne).toHaveBeenCalledTimes(1);
                expect(fakeCollection.findOne).toHaveBeenCalledWith({
                    asid: "a38c287c-15c3-42f0-863f-872af171982d",
                });
            });
            it("should return the document without the MongoDB _id property", () => {
                expect(getSearchSessionResult).toEqual({
                    asid: "a38c287c-15c3-42f0-863f-872af171982d",
                    status: "COMPLETED",
                    payload: {
                        asid: "a38c287c-15c3-42f0-863f-872af171982d",
                        stay: {
                            adults: 2,
                            children: 0,
                            rooms: 1,
                            checkIn: "2024-06-12",
                            checkOut: "2024-06-14",
                        },
                        place: {
                            coords: {
                                latitude: 28.5383832,
                                longitude: -81.3789269,
                            },
                            text: "Orlando, FL, USA",
                        },
                        radiusMiles: 20,
                        pagination: {
                            offset: 0,
                        },
                    },
                });
            });
        });
        describe("when calling cancelSearch", () => {
            beforeEach(async () => {
                const mod = await import("./SearchSessionRepository");
                repoInstance = await mod.getSearchSessionRepository();
                await repoInstance.cancelSearch("ASID", "SEARCH_ID");
            });
            it("should call updateOne on the instance collection", () => {
                expect(fakeCollection.updateOne).toHaveBeenCalledTimes(1);
                expect(fakeCollection.updateOne).toHaveBeenCalledWith(
                    { asid: "ASID", "criteria.searchId": "SEARCH_ID" },
                    {
                        $set: {
                            status: SearchSessionStatus.CANCELLED,
                        },
                    }
                );
            });
        });
        describe("when calling forceSessionStatusToCompleted", () => {
            beforeEach(async () => {
                const mod = await import("./SearchSessionRepository");
                repoInstance = await mod.getSearchSessionRepository();
                await repoInstance.forceSessionStatusToCompleted("ASID");
            });
            it("should call updateOne on the instance collection", () => {
                expect(fakeCollection.updateOne).toHaveBeenCalledTimes(1);
                expect(fakeCollection.updateOne).toHaveBeenCalledWith(
                    {
                        asid: "ASID",
                    },
                    {
                        $set: {
                            status: SearchSessionStatus.COMPLETED,
                        },
                    }
                );
            });
        });
    });
    describe("when invoking the feature flag client's addHandler callback", () => {
        beforeEach(async () => {
            flagClient.addHandler.mockReset();
            flagClient.addHandler.mockImplementationOnce((_event: any, cb: any) => {
                cb();
            });
            const mod = await import("./SearchSessionRepository");
            process.env.MONGO_URL = "MONGO_URL";
            repoInstance = await mod.getSearchSessionRepository();
        });
        it("should drop the session doc index (in addition to the calls from init)", () => {
            expect(fakeCollection.dropIndex).toHaveBeenNthCalledWith(
                2,
                "search_session_doc_expiration"
            );
        });
        it("should create the expected indexes (in addition to the calls from init)", () => {
            expect(fakeCollection.createIndex).toHaveBeenNthCalledWith(
                3,
                { updatedAt: 1 },
                { expireAfterSeconds: 3600, name: "search_session_doc_expiration" }
            );
        });
    });
    describe("when dropping the index fails", () => {
        let err: any;
        beforeEach(async () => {
            err = new Error("E_CLEANHOUSE_SANITY_KIDS_PICK_TWO"); // The parental CAP theorem
            fakeCollection.dropIndex.mockReset();
            fakeCollection.dropIndex.mockRejectedValueOnce(err);
            const mod = await import("./SearchSessionRepository");
            process.env.MONGO_URL = "MONGO_URL";
            repoInstance = await mod.getSearchSessionRepository();
        });
        it("should log a warning", () => {
            expect(mock_logger.warn).toHaveBeenCalledWith(
                `Unable to drop index search_session_doc_expiration: ${err}`
            );
        });
    });
});
```

---

## Example: useAnimationClassesV3

```typescript
// useAnimationClassesV3.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-anonymous-default-export */
import { squelchConsole, unsquelchConsole } from "@apogee-travel/common-test";
export default {};
const mockUseSearchParamsStore = jest.fn();
jest.mock("@/contexts/RootStoreContext", () => {
    return { useSearchParamsStore: mockUseSearchParamsStore };
});
const mockReact = {
    useCallback: jest.fn(),
    useMemo: jest.fn(),
    useState: jest.fn(),
};
jest.mock("react", () => {
    return mockReact;
});
describe("clients > customers-web > src > pages > search > useAnimationClassesV3", () => {
    let mockLogger: any,
        origSetTimeout: any,
        origClearTimeout: any,
        mockSearchParamsStore: any,
        mapTransitionStatus: any,
        setMapTransitionStatus: any,
        result: any;
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        squelchConsole();
        origSetTimeout = global.setTimeout;
        origClearTimeout = global.clearTimeout;
        // @ts-ignore
        global.setTimeout = jest.fn().mockImplementation((cb) => {
            cb();
            return "timeoutId";
        });
        global.clearTimeout = jest.fn();
        mockSearchParamsStore = {
            actions: {
                resetRadiusMilesToDefault: jest.fn(),
            },
        };
        mapTransitionStatus = "collapsed";
        setMapTransitionStatus = jest.fn();
        mockReact.useState.mockReturnValueOnce([mapTransitionStatus, setMapTransitionStatus]);
        mockUseSearchParamsStore.mockReturnValue(mockSearchParamsStore);
        mockReact.useMemo.mockImplementationOnce((cb) => {
            return cb();
        });
        mockReact.useMemo.mockImplementationOnce((cb) => {
            return cb();
        });
        mockReact.useMemo.mockImplementationOnce((cb) => {
            return cb();
        });
        mockReact.useCallback.mockImplementationOnce(() => {
            return "expandMap";
        });
        mockReact.useCallback.mockImplementationOnce(() => {
            return "collapseMap";
        });
    });
    afterEach(() => {
        global.setTimeout = origSetTimeout;
        global.clearTimeout = origClearTimeout;
        unsquelchConsole();
    });
    describe("with hook init", () => {
        beforeEach(async () => {
            const mod = await import("./useAnimationClassesV3");
            result = mod.useAnimationClassesV3();
        });
        it("should track state for mapTransitionStatus", () => {
            expect(mockReact.useState).toHaveBeenNthCalledWith(1, null);
        });
        it("should create a memo for isMapExpanded", () => {
            expect(mockReact.useMemo).toHaveBeenNthCalledWith(1, expect.any(Function), [
                mapTransitionStatus,
            ]);
        });
        it("should create an expandMap callback", () => {
            expect(mockReact.useCallback).toHaveBeenNthCalledWith(1, expect.any(Function), []);
        });
        it("should create an collapseMap callback", () => {
            expect(mockReact.useCallback).toHaveBeenNthCalledWith(2, expect.any(Function), []);
        });
        it("should create a memo for mapClasses", () => {
            expect(mockReact.useMemo).toHaveBeenNthCalledWith(2, expect.any(Function), [
                mapTransitionStatus,
            ]);
        });
        it("should create a memo for resultsClasses", () => {
            expect(mockReact.useMemo).toHaveBeenNthCalledWith(3, expect.any(Function), [
                mapTransitionStatus,
            ]);
        });
        it("should return the expected value", () => {
            expect(result).toEqual({
                mapClasses: "search-page__map search-page__map--up",
                resultsClasses: "search-page__results-list search-page__results-list--up",
                isMapExpanded: false,
                expandMap: "expandMap",
                collapseMap: "collapseMap",
            });
        });
    });
    describe("with the isExpanded memo", () => {
        describe("when mapTransitionStatus is null", () => {
            beforeEach(async () => {
                mockReact.useState.mockReset();
                mapTransitionStatus = null;
                mockReact.useState.mockReturnValueOnce([
                    mapTransitionStatus,
                    setMapTransitionStatus,
                ]);
                const mod = await import("./useAnimationClassesV3");
                result = mod.useAnimationClassesV3();
            });
            it("should return false", () => {
                expect(result.isMapExpanded).toBe(false);
            });
        });
        describe("when mapTransitionStatus is 'collapsed'", () => {
            beforeEach(async () => {
                mockReact.useState.mockReset();
                mapTransitionStatus = "collapsed";
                mockReact.useState.mockReturnValueOnce([
                    mapTransitionStatus,
                    setMapTransitionStatus,
                ]);
                const mod = await import("./useAnimationClassesV3");
                result = mod.useAnimationClassesV3();
            });
            it("should return false", () => {
                expect(result.isMapExpanded).toBe(false);
            });
        });
        describe("when mapTransitionStatus is not 'collapsed'", () => {
            beforeEach(async () => {
                mockReact.useState.mockReset();
                mapTransitionStatus = "expanded";
                mockReact.useState.mockReturnValueOnce([
                    mapTransitionStatus,
                    setMapTransitionStatus,
                ]);
                const mod = await import("./useAnimationClassesV3");
                result = mod.useAnimationClassesV3();
            });
            it("should return true", () => {
                expect(result.isMapExpanded).toBe(true);
            });
        });
    });
    describe("with the expandMap callback", () => {
        beforeEach(async () => {
            mockReact.useCallback.mockReset();
            mockReact.useCallback.mockImplementationOnce((cb) => {
                cb()();
                return "expandMap";
            });
            mockReact.useCallback.mockImplementationOnce(() => {
                // no-op
                return "collapseMap";
            });
            const mod = await import("./useAnimationClassesV3");
            result = mod.useAnimationClassesV3();
        });
        it("should first set mapTransitionStatus to 'expanding'", () => {
            expect(setMapTransitionStatus).toHaveBeenNthCalledWith(1, "expanding");
        });
        it("should call setTimeout with a duration of MAP_ANIM_DURATION_MS", () => {
            expect(global.setTimeout).toHaveBeenNthCalledWith(1, expect.any(Function), 750);
        });
        it("should next call setMapTransitionStatus with 'expanded'", () => {
            expect(setMapTransitionStatus).toHaveBeenNthCalledWith(2, "expanded");
        });
        it("should return a function that clears the timeout", () => {
            expect(global.clearTimeout).toHaveBeenNthCalledWith(1, "timeoutId");
        });
    });
    describe("with the collapseMap callback", () => {
        beforeEach(async () => {
            mockReact.useCallback.mockReset();
            mockReact.useCallback.mockImplementationOnce(() => {
                // no-op
                return "expandMap";
            });
            mockReact.useCallback.mockImplementationOnce((cb) => {
                cb()();
                return "collapseMap";
            });
            const mod = await import("./useAnimationClassesV3");
            result = mod.useAnimationClassesV3();
        });
        it("should first set mapTransitionStatus to 'collapsing'", () => {
            expect(setMapTransitionStatus).toHaveBeenNthCalledWith(1, "collapsing");
        });
        it("should call setTimeout with a duration of MAP_ANIM_DURATION_MS", () => {
            expect(global.setTimeout).toHaveBeenNthCalledWith(1, expect.any(Function), 750);
        });
        it("should next call setMapTransitionStatus with 'collapsed'", () => {
            expect(setMapTransitionStatus).toHaveBeenNthCalledWith(2, "collapsed");
        });
        it("should return a function that clears the timeout", () => {
            expect(global.clearTimeout).toHaveBeenNthCalledWith(1, "timeoutId");
        });
    });
    describe("with the mapClasses memo", () => {
        describe("when mapTransitionStatus is 'collapsing'", () => {
            beforeEach(async () => {
                mockReact.useState.mockReset();
                mapTransitionStatus = "collapsing";
                mockReact.useState.mockReturnValueOnce([
                    mapTransitionStatus,
                    setMapTransitionStatus,
                ]);
                const mod = await import("./useAnimationClassesV3");
                result = mod.useAnimationClassesV3();
            });
            it("should return the expected classnames value", () => {
                expect(result.mapClasses).toBe("search-page__map search-page__map--up");
            });
        });
        describe("when mapTransitionStatus is 'collapsed'", () => {
            beforeEach(async () => {
                mockReact.useState.mockReset();
                mapTransitionStatus = "collapsed";
                mockReact.useState.mockReturnValueOnce([
                    mapTransitionStatus,
                    setMapTransitionStatus,
                ]);
                const mod = await import("./useAnimationClassesV3");
                result = mod.useAnimationClassesV3();
            });
            it("should return the expected classnames value", () => {
                expect(result.mapClasses).toBe("search-page__map search-page__map--up");
            });
        });
        describe("when mapTransitionStatus is 'expanding'", () => {
            beforeEach(async () => {
                mockReact.useState.mockReset();
                mapTransitionStatus = "expanding";
                mockReact.useState.mockReturnValueOnce([
                    mapTransitionStatus,
                    setMapTransitionStatus,
                ]);
                const mod = await import("./useAnimationClassesV3");
                result = mod.useAnimationClassesV3();
            });
            it("should return the expected classnames value", () => {
                expect(result.mapClasses).toBe("search-page__map search-page__map--down");
            });
        });
        describe("when mapTransitionStatus is 'expanded'", () => {
            beforeEach(async () => {
                mockReact.useState.mockReset();
                mapTransitionStatus = "expanded";
                mockReact.useState.mockReturnValueOnce([
                    mapTransitionStatus,
                    setMapTransitionStatus,
                ]);
                const mod = await import("./useAnimationClassesV3");
                result = mod.useAnimationClassesV3();
            });
            it("should return the expected classnames value", () => {
                expect(result.mapClasses).toBe("search-page__map search-page__map--down");
            });
        });
    });
    describe("with the resultsClasses memo", () => {
        describe("when mapTransitionStatus is 'collapsing'", () => {
            beforeEach(async () => {
                mockReact.useState.mockReset();
                mapTransitionStatus = "collapsing";
                mockReact.useState.mockReturnValueOnce([
                    mapTransitionStatus,
                    setMapTransitionStatus,
                ]);
                const mod = await import("./useAnimationClassesV3");
                result = mod.useAnimationClassesV3();
            });
            it("should return the expected classnames value", () => {
                expect(result.resultsClasses).toBe(
                    "search-page__results-list search-page__results-list--up"
                );
            });
        });
        describe("when mapTransitionStatus is 'collapsed'", () => {
            beforeEach(async () => {
                mockReact.useState.mockReset();
                mapTransitionStatus = "collapsed";
                mockReact.useState.mockReturnValueOnce([
                    mapTransitionStatus,
                    setMapTransitionStatus,
                ]);
                const mod = await import("./useAnimationClassesV3");
                result = mod.useAnimationClassesV3();
            });
            it("should return the expected classnames value", () => {
                expect(result.resultsClasses).toBe(
                    "search-page__results-list search-page__results-list--up"
                );
            });
        });
        describe("when mapTransitionStatus is 'expanding'", () => {
            beforeEach(async () => {
                mockReact.useState.mockReset();
                mapTransitionStatus = "expanding";
                mockReact.useState.mockReturnValueOnce([
                    mapTransitionStatus,
                    setMapTransitionStatus,
                ]);
                const mod = await import("./useAnimationClassesV3");
                result = mod.useAnimationClassesV3();
            });
            it("should return the expected classnames value", () => {
                expect(result.resultsClasses).toBe(
                    "search-page__results-list search-page__results-list--down"
                );
            });
        });
        describe("when mapTransitionStatus is 'expanded'", () => {
            beforeEach(async () => {
                mockReact.useState.mockReset();
                mapTransitionStatus = "expanded";
                mockReact.useState.mockReturnValueOnce([
                    mapTransitionStatus,
                    setMapTransitionStatus,
                ]);
                const mod = await import("./useAnimationClassesV3");
                result = mod.useAnimationClassesV3();
            });
            it("should return the expected classnames value", () => {
                expect(result.resultsClasses).toBe(
                    "search-page__results-list search-page__results-list--down"
                );
            });
        });
    });
});
```

---

## Example: search-operation-batch

```typescript
// search-operation-batch.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
const mockLuxon = {
    DateTime: {
        utc: jest.fn().mockReturnThis(),
        toISO: jest.fn(),
    },
};
jest.mock("luxon", () => {
    return mockLuxon;
});
const mockSearchTelemetryApi = {
    traceEvent: jest.fn(),
};
jest.mock("../../../data/SearchTelemetry/searchTelemetryApi", () => {
    return mockSearchTelemetryApi;
});
const mockShouldContinueSearchExecution = jest.fn();
jest.mock("../common/shouldContinueSearchExecution", () => {
    return { shouldContinueSearchExecution: mockShouldContinueSearchExecution };
});
const mockGetProfilesAndAvailabilitiesForBatch = jest.fn();
jest.mock("./getProfilesAndAvailabilitiesForBatch", () => {
    return {
        getProfilesAndAvailabilitiesForBatch: mockGetProfilesAndAvailabilitiesForBatch,
    };
});
const mockPublishSearchResultSuccessMessages = jest.fn();
jest.mock("./publishSearchResultSuccessMessages", () => {
    return {
        publishSearchResultSuccessMessages: mockPublishSearchResultSuccessMessages,
    };
});
const mockPublishSearchResultFailureMessages = jest.fn();
jest.mock("./publishSearchResultFailureMessages", () => {
    return {
        publishSearchResultFailureMessages: mockPublishSearchResultFailureMessages,
    };
});
import { mock_logger } from "@apogee-travel/common-test";
import { V3SearchTraceEventType } from "../../../routes/search/availability/v3/types";
import { Message } from "amqplib";
describe("hotel-availability > src > messaging > handlers > search-operation-batch > index", () => {
    let content: any, ackOrNack: any;
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        mockLuxon.DateTime.toISO.mockReturnValue("2025-12-31T00:00:00.000Z");
        mockGetProfilesAndAvailabilitiesForBatch.mockResolvedValueOnce("RESULTS");
        mockPublishSearchResultSuccessMessages.mockResolvedValueOnce(undefined);
        mockPublishSearchResultFailureMessages.mockResolvedValueOnce(undefined);
        content = {
            asid: "ASID",
            searchId: "SEARCH_ID",
            executionId: "EXECUTION_ID",
            channel: "amadeus",
            batch: "amadeus-1",
            stay: "STAY",
            suppliers: ["SUPPLIER1", "SUPPLIER2"],
            donatedInventory: "DONATEDINVENTORY",
        };
        ackOrNack = jest.fn();
    });
    describe("when content is an empty object", () => {
        beforeEach(async () => {
            const mod = await import("./index");
            await mod.searchOperationBatchHandler({} as Message, {}, ackOrNack);
        });
        it("should not call shouldContinueSearchExecution", () => {
            expect(mockShouldContinueSearchExecution).not.toHaveBeenCalled();
        });
        it("should call ackOrNack", () => {
            expect(ackOrNack).toHaveBeenCalledTimes(1);
        });
    });
    describe("when everything goes splendiferously", () => {
        beforeEach(async () => {
            mockShouldContinueSearchExecution.mockResolvedValueOnce(true);
            const mod = await import("./index");
            await mod.searchOperationBatchHandler({} as Message, content, ackOrNack);
        });
        it("should call traceEvent with a SEARCH_BATCH_RECEIVED event", () => {
            expect(mockSearchTelemetryApi.traceEvent).toHaveBeenCalledTimes(4);
            expect(mockSearchTelemetryApi.traceEvent).toHaveBeenNthCalledWith(1, {
                asid: "ASID",
                searchId: "SEARCH_ID",
                executionId: "EXECUTION_ID",
                eventType: V3SearchTraceEventType.SEARCH_BATCH_RECEIVED,
                metadata: {
                    channel: "amadeus",
                    batch: "amadeus-1",
                    supplierCount: 2,
                },
            });
        });
        it("should call traceEvent with a GDS_REQUEST_START event", () => {
            expect(mockSearchTelemetryApi.traceEvent).toHaveBeenNthCalledWith(2, {
                asid: "ASID",
                searchId: "SEARCH_ID",
                executionId: "EXECUTION_ID",
                eventType: V3SearchTraceEventType.GDS_REQUEST_START,
                metadata: {
                    channel: "amadeus",
                    batch: "amadeus-1",
                },
            });
        });
        it("should call getProfilesAndAvailabilitiesForBatch with the expected args", () => {
            expect(mockGetProfilesAndAvailabilitiesForBatch).toHaveBeenCalledTimes(1);
            expect(mockGetProfilesAndAvailabilitiesForBatch).toHaveBeenCalledWith({
                asid: "ASID",
                searchId: "SEARCH_ID",
                executionId: "EXECUTION_ID",
                channel: "amadeus",
                stay: "STAY",
                suppliers: ["SUPPLIER1", "SUPPLIER2"],
                donatedInventory: "DONATEDINVENTORY",
            });
        });
        it("should call traceEvent with a GDS_REQUEST_START event", () => {
            expect(mockSearchTelemetryApi.traceEvent).toHaveBeenNthCalledWith(3, {
                asid: "ASID",
                searchId: "SEARCH_ID",
                executionId: "EXECUTION_ID",
                eventType: V3SearchTraceEventType.GDS_REQUEST_END,
                metadata: {
                    channel: "amadeus",
                    batch: "amadeus-1",
                },
            });
        });
        it("should call publishSearchResultSuccessMessages with the expected args", () => {
            expect(mockPublishSearchResultSuccessMessages).toHaveBeenCalledTimes(1);
            expect(mockPublishSearchResultSuccessMessages).toHaveBeenCalledWith({
                asid: "ASID",
                searchId: "SEARCH_ID",
                executionId: "EXECUTION_ID",
                channel: "amadeus",
                batch: "amadeus-1",
                results: "RESULTS",
            });
        });
        it("should call traceEvent with a SEARCH_BATCH_RESULTS_PUBLISHED event", () => {
            expect(mockSearchTelemetryApi.traceEvent).toHaveBeenNthCalledWith(4, {
                asid: "ASID",
                searchId: "SEARCH_ID",
                executionId: "EXECUTION_ID",
                eventType: V3SearchTraceEventType.SEARCH_BATCH_RESULTS_PUBLISHED,
                metadata: {
                    channel: "amadeus",
                    batch: "amadeus-1",
                    isError: false,
                },
            });
        });
        it("should call ackOrNack", () => {
            expect(ackOrNack).toHaveBeenCalledTimes(1);
        });
    });
    describe("when the search should not continue executing", () => {
        beforeEach(async () => {
            mockShouldContinueSearchExecution.mockResolvedValueOnce(false);
            const mod = await import("./index");
            await mod.searchOperationBatchHandler({} as Message, content, ackOrNack);
        });
        it("should not call getProfilesAndAvailabilitiesForBatch", () => {
            expect(mockGetProfilesAndAvailabilitiesForBatch).not.toHaveBeenCalled();
        });
    });
    describe("when an exception is thrown", () => {
        let err: any;
        beforeEach(async () => {
            mockShouldContinueSearchExecution.mockResolvedValueOnce(true);
            err = new Error("E_DEEP_STATE");
            mockGetProfilesAndAvailabilitiesForBatch.mockReset();
            mockGetProfilesAndAvailabilitiesForBatch.mockRejectedValueOnce(err);
            const mod = await import("./index");
            await mod.searchOperationBatchHandler({} as Message, content, ackOrNack);
        });
        it("should log an error message", () => {
            expect(mock_logger.error).toHaveBeenCalledWith(
                "V3 Search (ASID|SEARCH_ID):search operation batch handler error:",
                { error: err }
            );
        });
        it("should call publishSearchResultFailureMessages with the expected args", () => {
            expect(mockPublishSearchResultFailureMessages).toHaveBeenCalledTimes(1);
            expect(mockPublishSearchResultFailureMessages).toHaveBeenCalledWith({
                asid: "ASID",
                searchId: "SEARCH_ID",
                executionId: "EXECUTION_ID",
                channel: "amadeus",
                batch: "amadeus-1",
                suppliers: content.suppliers,
            });
        });
        it("should call ackOrNack with the expected args", () => {
            expect(ackOrNack).toHaveBeenCalledTimes(1);
            expect(ackOrNack).toHaveBeenCalledWith(err as Error, {
                strategy: "nack",
            });
        });
    });
});
```

---

## Example: userStore

```typescript
// userStore/index.test.ts
import { UserRewardsMemberType } from "@/types";
export default {};
const mockCreateStore = jest.fn();
jest.mock("@apogeelabs/beacon", () => {
    return {
        createStore: mockCreateStore,
    };
});
describe("src > store > userStore > index", () => {
    let storeCfg: any;
    beforeEach(async () => {
        jest.resetAllMocks();
        jest.resetModules();
        mockCreateStore.mockImplementationOnce((cfg: any) => {
            return cfg; // returning the store config so we can invoke derived and actions
        });
    });
    describe("when calling createUserStore", () => {
        beforeEach(async () => {
            const mod = await import("./index");
            storeCfg = mod.createUserStore();
        });
        it("should call createStore with the expected configuration", () => {
            expect(mockCreateStore).toHaveBeenCalledWith({
                initialState: {
                    isAuthenticated: false,
                    isAuthStatusLoading: false,
                    isInitialLoading: false,
                    isUserMetadataLoading: false,
                    user: null,
                    userMetadataError: null,
                    defaultCharity: null,
                    rawRewardsMetadata: null,
                },
                derived: {
                    hasKnownAuthStatus: expect.any(Function),
                    isInitializing: expect.any(Function),
                    notificationPreferences: expect.any(Function),
                    rewardsMetadata: expect.any(Function),
                },
                actions: {
                    setIsAuthenticated: expect.any(Function),
                    setIsAuthLoading: expect.any(Function),
                    setIsUserMetadataLoading: expect.any(Function),
                    setUser: expect.any(Function),
                    setDefaultCharity: expect.any(Function),
                    clearUser: expect.any(Function),
                },
            });
        });
    });
    describe("with the user store derived state configuration", () => {
        beforeEach(async () => {
            const mod = await import("./index");
            storeCfg = mod.createUserStore();
        });
        describe("with hasKnownAuthStatus", () => {
            it("should return true for hasKnownAuthStatus when isAuthenticated is true", () => {
                expect(storeCfg.derived.hasKnownAuthStatus({ isAuthenticated: true })).toBe(true);
            });
            it("should return true for hasKnownAuthStatus when isAuthenticated is false", () => {
                expect(storeCfg.derived.hasKnownAuthStatus({ isAuthenticated: false })).toBe(true);
            });
            it("should return false for hasKnownAuthStatus when isAuthenticated is null", () => {
                expect(storeCfg.derived.hasKnownAuthStatus({ isAuthenticated: null })).toBe(false);
            });
        });
        describe("with isInitializing", () => {
            it("should return true for isInitializing when isAuthStatusLoading is true", () => {
                expect(storeCfg.derived.isInitializing({ isAuthStatusLoading: true })).toBe(true);
            });
            it("should return true for isInitializing when isInitialLoading is true", () => {
                expect(storeCfg.derived.isInitializing({ isInitialLoading: true })).toBe(true);
            });
            it("should return true for isInitializing when isUserMetadataLoading is true", () => {
                expect(storeCfg.derived.isInitializing({ isUserMetadataLoading: true })).toBe(true);
            });
            it("should return false for isInitializing when all loading states are false", () => {
                expect(
                    storeCfg.derived.isInitializing({
                        isAuthStatusLoading: false,
                        isInitialLoading: false,
                        isUserMetadataLoading: false,
                    })
                ).toBe(false);
            });
        });
        describe("with notificationPreferences", () => {
            describe("when user is null", () => {
                it("should return default notification preferences", () => {
                    expect(
                        storeCfg.derived.notificationPreferences({
                            user: null,
                        })
                    ).toEqual({ email: false, sms: false });
                });
            });
            describe("when user is not null", () => {
                it("should return default notification preferences", () => {
                    expect(
                        storeCfg.derived.notificationPreferences({
                            user: {},
                        })
                    ).toEqual({ email: false, sms: false });
                });
                it("should return notification preferences when present", () => {
                    const user = {
                        notification_preferences: {
                            prefs: [
                                { channel: "email", type: "marketing", enabled: true },
                                { channel: "sms", type: "system", enabled: false },
                            ],
                        },
                    };
                    expect(storeCfg.derived.notificationPreferences({ user })).toEqual({
                        email: true,
                        sms: false,
                    });
                });
            });
        });
        describe("with rewardsMetadata", () => {
            describe("when rawRewardsMetadata is null", () => {
                it("should return default rewards metadata", () => {
                    expect(
                        storeCfg.derived.rewardsMetadata({
                            rawRewardsMetadata: null,
                        })
                    ).toEqual({
                        balance: 0,
                        bookingCount: 0,
                        earningRate: "1x",
                        memberType: UserRewardsMemberType.MEMBER,
                    });
                });
            });
            describe("when rawRewardsMetadata is not null", () => {
                it("should return the actual rewards metadata", () => {
                    expect(
                        storeCfg.derived.rewardsMetadata({
                            rawRewardsMetadata: {
                                balance: 42,
                                bookingCount: 12,
                                earningRate: "2x",
                                memberType: UserRewardsMemberType.ELITE,
                            },
                        })
                    ).toEqual({
                        balance: 42,
                        bookingCount: 12,
                        earningRate: "2x",
                        memberType: UserRewardsMemberType.ELITE,
                    });
                });
            });
        });
    });
    describe("with the user store actions configuration", () => {
        let targetState: any;
        beforeEach(async () => {
            const mod = await import("./index");
            storeCfg = mod.createUserStore();
            targetState = {};
        });
        it("should set state to expected values when calling setIsAuthenticated", () => {
            storeCfg.actions.setIsAuthenticated(targetState, true);
            expect(targetState).toEqual({
                isAuthenticated: true,
                isAuthStatusLoading: false,
            });
        });
        it("should set state to expected values when calling setIsAuthLoading", () => {
            storeCfg.actions.setIsAuthLoading(targetState, true);
            expect(targetState).toEqual({
                isAuthLoading: true,
            });
        });
        it("should set state to expected values when calling setIsUserMetadataLoading", () => {
            storeCfg.actions.setIsUserMetadataLoading(targetState, true);
            expect(targetState).toEqual({
                isUserMetadataLoading: true,
            });
        });
        it("should set state to expected values when calling setUser with a user that has rewards metadata", () => {
            const user = {
                id: "123",
                name: "Cal Zone",
                rewardsMetadata: {
                    balance: 42,
                    bookingCount: 12,
                    earningRate: "2x",
                    memberType: UserRewardsMemberType.ELITE,
                },
            };
            storeCfg.actions.setUser(targetState, user);
            expect(targetState).toEqual({
                user: {
                    id: "123",
                    name: "Cal Zone",
                },
                isUserMetadataLoading: false,
                rawRewardsMetadata: {
                    balance: 42,
                    bookingCount: 12,
                    earningRate: "2x",
                    memberType: UserRewardsMemberType.ELITE,
                },
            });
        });
        it("should set state to expected values when calling setUser with a user that has no rewards metadata", () => {
            const user = {
                id: "123",
                name: "Cal Zone",
                rewardsMetadata: undefined,
            };
            storeCfg.actions.setUser(targetState, user);
            expect(targetState).toEqual({
                user: {
                    id: "123",
                    name: "Cal Zone",
                },
                isUserMetadataLoading: false,
                rawRewardsMetadata: null,
            });
        });
        it("should set state to expected values when calling setDefaultCharity", () => {
            const charity = {
                ein: "123456789",
                name: "Calzone Research Institute",
            };
            storeCfg.actions.setDefaultCharity(targetState, charity);
            expect(targetState).toEqual({
                defaultCharity: charity,
            });
        });
        it("should set state to expected values when calling clearUser", () => {
            storeCfg.actions.clearUser(targetState);
            expect(targetState).toEqual({
                isAuthenticated: false,
                user: null,
                defaultCharity: null,
            });
        });
    });
});
```
