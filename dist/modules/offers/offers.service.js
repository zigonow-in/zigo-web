import { createOffer, getOffer, listAssistantReferralOffers, listEligibleOffersForCustomer, listOfferRedemptions, listOffers, setOfferStatus, updateOffer, validateCustomerOfferCode, validateCustomerReferralCode, validateOfferById } from "./offers.repository.js";
export class OfferMasterService {
    list(filters) {
        return listOffers(filters);
    }
    get(id) {
        return getOffer(id);
    }
    create(input) {
        return createOffer(input);
    }
    update(id, input) {
        return updateOffer(id, input);
    }
    validate(id) {
        return validateOfferById(id);
    }
    publish(id, userId) {
        return setOfferStatus(id, "ACTIVE", userId);
    }
    pause(id, userId) {
        return setOfferStatus(id, "PAUSED", userId);
    }
    archive(id, userId) {
        return setOfferStatus(id, "ARCHIVED", userId);
    }
}
export class OfferEligibilityService {
    eligibleForCustomer(customerUserId, filters) {
        return listEligibleOffersForCustomer(customerUserId, filters);
    }
}
export class OfferCodeService {
    validate(customerUserId, code, filters) {
        return validateCustomerOfferCode(customerUserId, code, filters);
    }
}
export class ReferralCodeService {
    validate(customerUserId, code) {
        return validateCustomerReferralCode(customerUserId, code);
    }
}
export class OfferValidationService extends OfferMasterService {
}
export class OfferPricingService {
}
export class PackagePurchaseService {
}
export class EntitlementService {
}
export class RedemptionService {
}
export class OfferReportingService {
    redemptions(offerId) {
        return listOfferRedemptions(offerId);
    }
}
export class AssistantReferralOfferService {
    listForAssistant(assistantUserId) {
        return listAssistantReferralOffers(assistantUserId);
    }
}
