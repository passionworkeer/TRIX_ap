//
//  InputValidator.swift
//  TRIX3DCompanion
//
//  Comprehensive input validation for security
//  Created: Phase 6F Security Audit
//

import Foundation
import LocalAuthentication

/// Validation error types
enum ValidationError: Error, LocalizedError {
    case emailInvalid
    case emailTooLong
    case emailMalformed
    case passwordTooShort
    case passwordNoUppercase
    case passwordNoLowercase
    case passwordNoNumber
    case passwordNoSpecialChar
    case passwordCommon
    case usernameTooShort
    case usernameTooLong
    case usernameInvalidCharacters
    case usernameReserved
    case inputEmpty
    case inputTooLong(maxLength: Int)
    case invalidFormat

    var errorDescription: String? {
        switch self {
        case .emailInvalid:
            return "Please enter a valid email address."
        case .emailTooLong:
            return "Email address is too long."
        case .emailMalformed:
            return "Email address format is invalid."
        case .passwordTooShort:
            return "Password must be at least 8 characters."
        case .passwordNoUppercase:
            return "Password must contain at least one uppercase letter."
        case .passwordNoLowercase:
            return "Password must contain at least one lowercase letter."
        case .passwordNoNumber:
            return "Password must contain at least one number."
        case .passwordNoSpecialChar:
            return "Password must contain at least one special character (!@#$%^&*)."
        case .passwordCommon:
            return "This password is too common. Please choose a more secure password."
        case .usernameTooShort:
            return "Username must be at least 3 characters."
        case .usernameTooLong:
            return "Username must be less than 30 characters."
        case .usernameInvalidCharacters:
            return "Username can only contain letters, numbers, and underscores."
        case .usernameReserved:
            return "This username is reserved and cannot be used."
        case .inputEmpty:
            return "This field cannot be empty."
        case .inputTooLong(let maxLength):
            return "This field cannot exceed \(maxLength) characters."
        case .invalidFormat:
            return "Invalid format."
        }
    }
}

/// Password strength level
enum PasswordStrength: Int, Comparable {
    case veryWeak = 0
    case weak = 1
    case fair = 2
    case good = 3
    case strong = 4

    var description: String {
        switch self {
        case .veryWeak: return "Very Weak"
        case .weak: return "Weak"
        case .fair: return "Fair"
        case .good: return "Good"
        case .strong: return "Strong"
        }
    }

    var color: String {
        switch self {
        case .veryWeak: return "red"
        case .weak: return "orange"
        case .fair: return "yellow"
        case .good: return "lightgreen"
        case .strong: return "green"
        }
    }

    static func < (lhs: PasswordStrength, rhs: PasswordStrength) -> Bool {
        return lhs.rawValue < rhs.rawValue
    }
}

/// Comprehensive input validator
final class InputValidator {

    // MARK: - Singleton

    static let shared = InputValidator()

    // MARK: - Constants

    /// Maximum email length per RFC 5321
    private let maxEmailLength = 254

    /// Minimum password length
    private let minPasswordLength = 8

    /// Maximum password length
    private let maxPasswordLength = 128

    /// Minimum username length
    private let minUsernameLength = 3

    /// Maximum username length
    private let maxUsernameLength = 30

    /// Reserved usernames
    private let reservedUsernames = Set([
        "admin", "administrator", "root", "system", "api",
        "support", "help", "info", "blog", "www",
        "mail", "email", "ftp", "localhost", "webmaster",
        "noreply", "no-reply", "test", "demo", "example"
    ])

    /// Common passwords blacklist
    /// Sources: NCSC UK, SplashData, Have I Been Pwned
    /// Top 500+ most common passwords to prevent weak password usage
    private let commonPasswords = Set([
        // Top 20 most common (NCSC UK survey)
        "123456", "123456789", "qwerty", "password", "111111",
        "12345678", "abc123", "1234567", "password1", "12345",
        "12345678910", "qwerty123", "1234567890", "password123", "qwertyuiop",
        "000000", "iloveyou", "123123", "admin", "welcome",

        // Numeric sequences
        "1234", "123", "12345678911", "12345678912", "12345678913",
        "12345678914", "12345678915", "12345678916", "12345678917", "12345678918",
        "12345678919", "12345678920", "12345678921", "12345678922", "12345678923",
        "12345678924", "12345678925", "12345678926", "12345678927", "12345678928",
        "12345678929", "12345678930", "12345678a", "12345678b", "12345678d",
        "12345678i", "12345678j", "12345678x", "12345678z", "12345qwert",
        "12345zxcvb", "123abc", "123qwe", "123qwerty", "131313",
        "171717", "181818", "202020", "202122", "212121",
        "222222", "232323", "252525", "262626", "282828",
        "323232", "333333", "369369", "373737", "383838",
        "424242", "444444", "454545", "484848", "505050",
        "525252", "555555", "565656", "585858", "595959",
        "606060", "626262", "636363", "656565", "666666",
        "696969", "707070", "727272", "757575", "767676",
        "777777", "787878", "797979", "808080", "818181",
        "828282", "858585", "868868", "888888", "909090",
        "919191", "929292", "937992", "989898", "999999",

        // Keyboard patterns
        "qwerty", "qwerty123", "qwerty1", "qwertyuiop", "qwer",
        "qwert", "qwert123", "qwertty", "qwe", "qwe123",
        "qwe123456", "qweqwe", "qwerty12", "qwertyui", "qwer123456",
        "asdfgh", "asdfghjkl", "asdf", "asdf1234", "asdfghj",
        "asdfghjkl;", "asdf123", "asdfghjk", "asdfjkl;",
        "zxcvbn", "zxcvbnm", "zxcvb", "zxcvbn123", "zxcv",
        "zxcv123", "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx", "1q2w3e",
        "2wsx3edc", "3edc4rfv", "qazwsx", "qazwsxedc", "zaq12wsx",

        // Common words and phrases
        "password", "password1", "password123", "password12", "password11",
        "password!", "password1234", "password12#", "password1!", "password@",
        "pass", "passw0rd", "passw0rd1", "pass123", "pass1234",
        "passw0rds", "passw0rd!", "mypass", "mypassword", "letmein",
        "iloveyou", "iloveyou!", "love", "loveyou", "loveyou123",
        "hello", "hello123", "hello1", "welcome", "welcome1",
        "admin", "admin123", "admin1234", "administrator", "root",
        "user", "guest", "test", "test123", "test1234",
        "demo", "demo123", "shadow", "master", "super",
        "sunshine", "sunshine1", "princess", "princess1", "dragon",
        "dragon1", "football", "football1", "baseball", "baseball1",
        "soccer", "soccer1", "hockey", "hockey1", "basketball",
        "basketball1", "tennis", "tennis1", "golf", "golf1",

        // Names
        "jordan", "jordan23", "michael", "michael1", "justin",
        "justin1", "matthew", "matthew1", "daniel", "daniel1",
        "andrew", "andrew1", "rachel", "rachel1", "joshua",
        "joshua1", "emma", "emma1", "chelsea", "chelsea1",
        "nicholas", "nicholas1", "samantha", "samantha1", "oliver",
        "oliver1", "taylor", "taylor1", "jennifer", "jennifer1",
        "ashley", "ashley1", "michelle", "michelle1", "kevin",
        "kevin1", "jason", "jason1", "amanda", "amanda1",
        "john", "johnny", "john321", "jessica", "jessica1",

        // Technology terms
        "computer", "computer1", "internet", "internet1", "system",
        "system1", "server", "server1", "network", "network1",
        "oracle", "oracle1", "database", "database1", "access",
        "access1", "photoshop", "photoshop1", "windows", "windows1",
        "microsoft", "microsoft1", "office", "office1", "outlook",
        "outlook1", "excel", "excel1", "word", "word1",

        // Phrases
        "trustno1", "trustno1!", "whatever", "whatever1", "fuckyou",
        "fuckyou1", "ihateyou", "ihateyou1", "blink182", "buster",
        "buster1", "cheese", "cheese1", "coffee", "coffee1",
        "pepper", "pepper1", "ginger", "ginger1", "banana",
        "banana1", "orange", "orange1", "apple", "apple1",
        "monkey", "monkey1", "donkey", "donkey1", "chicken",
        "chicken1", "dolphin", "dolphin1", "eagle1", "mustang",

        // Years and dates
        "2010", "2011", "2012", "2013", "2014",
        "2015", "2016", "2017", "2018", "2019",
        "2020", "2021", "2022", "2023", "2024",
        "2025", "2026", "2027", "2028", "2029",
        "2030", "1990", "1991", "1992", "1993",
        "1994", "1995", "1996", "1997", "1998",
        "1999", "1980", "1981", "1982", "1983",
        "1984", "1985", "1986", "1987", "1988",
        "1989", "01012020", "01011990", "01012000", "01011980",

        // Brand/company names
        "google", "google123", "facebook", "facebook1", "youtube",
        "youtube1", "twitter", "twitter1", "instagram", "instagram1",
        "amazon", "amazon1", "netflix", "netflix1", "spotify",
        "spotify1", "apple", "apple123", "samsung", "samsung1",
        "paypal", "paypal1", "adobe123", "nintendo", "nintendo1",
        "sony", "sony123", "microsoft", "msn", "msn123",
        "skype", "skype1", "yahoo", "yahoo1", "gmail",
        "gmail1", "hotmail", "hotmail1", "aol", "aol123",

        // Simple patterns
        "aaaaaa", "aaaaaa1", "aaaaaaa", "aaaaaa123", "bbbbbb",
        "bbbbbb1", "bbbbbbb", "bbbbbb123", "cccccc", "cccccc1",
        "ccccccc", "cccccc123", "dddddd", "dddddd1", "ddddddd",
        "dddddd123", "eeeeee", "eeeeee1", "eeeeeee", "eeeeee123",
        "abcd", "abcd123", "abcd1234", "abc123", "abc1234",
        "abc12345", "abc123456", "abcd12", "abcde", "abcde123",
        "xyz", "xyz123", "xyz1234", "xxx", "xxx123",

        // Repeated characters
        "aaaaaaaa", "aaaaaaa1", "bbbbbbbb", "bbbbbbb1", "cccccccc",
        "ccccccc1", "dddddddd", "ddddddd1", "eeeeeeee", "eeeeeee1",
        "11111111", "1111111a", "22222222", "33333333", "44444444",
        "55555555", "66666666", "77777777", "88888888", "99999999",
        "00000000", "1111111", "2222222", "3333333", "4444444",
        "5555555", "6666666", "7777777", "8888888", "9999999",

        // Common foreign passwords (international)
        "azerty", "azerty1", "azerty123", "azerty12", "qwertyuiop",
        "motdepasse", "passwordfr", "bonjour", "salut", "merci",
        "amour", "pomme", "pierre", "paris", "france",
        "schmerz", "passwort", "hallo", "liebe", "danke",
        "deutsch", "deutschland", "berlin", "munchen", "hamburg",
        "ciao", "italiano", "italia", "roma", "milano",
        "hola", "amigo", "gracias", "espana", "madrid",
        "ola", "brazil", "brasil", "rio", "saopaulo",
        "namaste", "india", "delhi", "mumbai", "kolkata",

        // Security-related
        "security", "security1", "login", "login123", "secret",
        "secret1", "passw0rd", "passwd", "passwd1", "p@ssw0rd",
        "p@ssword", "p@ssw0rd1", "p@ss123", "p@ss1234", "pass@123",
        "pass@word", "pass@word1", "s3cr3t", "s3cret", "s3cur1ty",

        // Gaming terms
        "pokemon", "pokemon1", "minecraft", "minecraft1", "fortnite",
        "fortnite1", "league", "league1", "lol123", "dota2",
        "dota1", "cs", "cs1.6", "csgo", "csgo1",
        "call", "call1", "duty", "duty1", "gaming",
        "gaming1", "gamer", "gamer1", "player", "player1",
        "nintendo", "xbox", "xbox1", "playstation", "ps4",
        "ps5", "steam", "steam1", "discord", "discord1",

        // Sports teams
        "chelsea", "liverpool", "arsenal", "manchester", "barcelona",
        "real", "madrid", "juventus", "milan", "bayern",
        "munich", "dortmund", "psg", "rangers", "celtic",

        // Additional common patterns
        "patrick", "patricia", "thomas", "thomas1", "james",
        "james1", "william", "william1", "robert", "robert1",
        "david", "david1", "richard", "richard1", "joseph",
        "joseph1", "charles", "charles1", "christopher", "christopher1",
        "george", "george1", "ronald", "ronald1", "timothy",
        "timothy1", "christine", "christine1", "maria", "maria1",
        "sandra", "sandra1", "sharon", "sharon1", "julie",
        "julie1", "laura", "laura1", "linda", "linda1"
    ])

    // MARK: - Email Validation

    /// Validate email address with comprehensive checks
    func validateEmail(_ email: String) -> Result<Void, ValidationError> {
        // Check empty
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .failure(.inputEmpty)
        }

        // Check length (RFC 5321: max 254 characters)
        guard trimmed.count <= maxEmailLength else {
            return .failure(.emailTooLong)
        }

        // Check basic format with improved regex
        let emailRegex = #"^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,61}[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,61}[A-Za-z0-9])?\.[A-Za-z]{2,}$"#
        guard trimmed.range(of: emailRegex, options: .regularExpression) != nil else {
            return .failure(.emailMalformed)
        }

        // Check for consecutive dots (not allowed)
        guard !trimmed.contains("..") else {
            return .failure(.emailMalformed)
        }

        // Check for leading/trailing dots
        guard !trimmed.hasPrefix(".") || !trimmed.hasSuffix(".") else {
            return .failure(.emailMalformed)
        }

        // Check for invalid characters in local part
        let components = trimmed.split(separator: "@")
        if components.count == 2 {
            let localPart = String(components[0])
            let invalidChars = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._%+-").inverted
            guard localPart.unicodeScalars.allSatisfy({ !invalidChars.contains($0) }) else {
                return .failure(.emailMalformed)
            }
        }

        return .success(())
    }

    // MARK: - Password Validation

    /// Validate password with comprehensive security checks
    func validatePassword(_ password: String) -> Result<Void, ValidationError> {
        // Check empty
        let trimmed = password.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .failure(.inputEmpty)
        }

        // Check length
        guard trimmed.count >= minPasswordLength else {
            return .failure(.passwordTooShort)
        }

        guard trimmed.count <= maxPasswordLength else {
            return .failure(.inputTooLong(maxLength: maxPasswordLength))
        }

        // Check for uppercase letter
        guard trimmed.range(of: "[A-Z]", options: .regularExpression) != nil else {
            return .failure(.passwordNoUppercase)
        }

        // Check for lowercase letter
        guard trimmed.range(of: "[a-z]", options: .regularExpression) != nil else {
            return .failure(.passwordNoLowercase)
        }

        // Check for number
        guard trimmed.range(of: "[0-9]", options: .regularExpression) != nil else {
            return .failure(.passwordNoNumber)
        }

        // Check for special character
        let specialChars = CharacterSet(charactersIn: "!@#$%^&*")
        guard trimmed.rangeOfCharacter(from: specialChars) != nil else {
            return .failure(.passwordNoSpecialChar)
        }

        // Check against common passwords
        let lowercased = trimmed.lowercased()
        guard !commonPasswords.contains(lowercased) else {
            return .failure(.passwordCommon)
        }

        return .success(())
    }

    /// Calculate password strength (0-4)
    func calculatePasswordStrength(_ password: String) -> PasswordStrength {
        var score = 0

        // Length check
        if password.count >= 8 { score += 1 }
        if password.count >= 12 { score += 1 }

        // Character variety
        if password.range(of: "[a-z]", options: .regularExpression) != nil { score += 1 }
        if password.range(of: "[A-Z]", options: .regularExpression) != nil { score += 1 }
        if password.range(of: "[0-9]", options: .regularExpression) != nil { score += 1 }
        if password.range(of: "[!@#$%^&*]", options: .regularExpression) != nil { score += 1 }

        // Complexity bonus
        if password.count >= 16 { score += 1 }

        // Common password penalty
        if commonPasswords.contains(password.lowercased()) {
            score = 0
        }

        // Map to strength levels
        switch score {
        case 0...2: return .veryWeak
        case 3: return .weak
        case 4: return .fair
        case 5: return .good
        case 6...: return .strong
        default: return .veryWeak
        }
    }

    // MARK: - Username Validation

    /// Validate username with security checks
    func validateUsername(_ username: String) -> Result<Void, ValidationError> {
        // Check empty
        let trimmed = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .failure(.inputEmpty)
        }

        // Check length
        guard trimmed.count >= minUsernameLength else {
            return .failure(.usernameTooShort)
        }

        guard trimmed.count <= maxUsernameLength else {
            return .failure(.usernameTooLong)
        }

        // Check for valid characters (letters, numbers, underscores only)
        let usernameRegex = #"^[a-zA-Z0-9_]+$"#
        guard trimmed.range(of: usernameRegex, options: .regularExpression) != nil else {
            return .failure(.usernameInvalidCharacters)
        }

        // Check if reserved
        let lowercased = trimmed.lowercased()
        guard !reservedUsernames.contains(lowercased) else {
            return .failure(.usernameReserved)
        }

        return .success(())
    }

    // MARK: - Generic Validation

    /// Validate that input is not empty
    func validateNotEmpty(_ input: String) -> Result<Void, ValidationError> {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .failure(.inputEmpty)
        }
        return .success(())
    }

    /// Validate input length
    func validateLength(_ input: String, min: Int? = nil, max: Int? = nil) -> Result<Void, ValidationError> {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        let length = trimmed.count

        if let min = min, length < min {
            return .failure(.inputEmpty)
        }

        if let max = max, length > max {
            return .failure(.inputTooLong(maxLength: max))
        }

        return .success(())
    }

    /// Validate numeric input
    func validateNumeric(_ input: String) -> Result<Void, ValidationError> {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .failure(.inputEmpty)
        }

        let numericRegex = #"^[0-9]+$"#
        guard trimmed.range(of: numericRegex, options: .regularExpression) != nil else {
            return .failure(.invalidFormat)
        }

        return .success(())
    }

    // MARK: - API Parameter Validation

    /// Validate API parameter (ID, code, etc.)
    func validateAPIParameter(_ parameter: String, maxLength: Int = 64) -> Result<Void, ValidationError> {
        let trimmed = parameter.trimmingCharacters(in: .whitespacesAndNewlines)

        // Check empty
        guard !trimmed.isEmpty else {
            return .failure(.inputEmpty)
        }

        // Check length
        guard trimmed.count <= maxLength else {
            return .failure(.inputTooLong(maxLength: maxLength))
        }

        // Check for valid characters (alphanumeric, dash, underscore)
        let paramRegex = #"^[a-zA-Z0-9_-]+$"#
        guard trimmed.range(of: paramRegex, options: .regularExpression) != nil else {
            return .failure(.invalidFormat)
        }

        return .success(())
    }

    /// Validate radius parameter for location queries
    func validateRadius(_ radius: Double) -> Result<Void, ValidationError> {
        guard radius > 0 else {
            return .failure(.invalidFormat)
        }

        guard radius <= 50000 else { // Max 50km
            return .failure(.inputTooLong(maxLength: 50000))
        }

        return .success(())
    }

    // MARK: - Batch Validation

    /// Validate multiple inputs and return first error or success
    func validateAll(_ validations: [Result<Void, ValidationError>]) -> Result<Void, ValidationError> {
        for validation in validations {
            switch validation {
            case .failure(let error):
                return .failure(error)
            case .success:
                continue
            }
        }
        return .success(())
    }
}

// MARK: - Convenience Extensions

extension InputValidator {

    /// Quick email validation check
    func isValidEmail(_ email: String) -> Bool {
        switch validateEmail(email) {
        case .success: return true
        case .failure: return false
        }
    }

    /// Quick password validation check
    func isValidPassword(_ password: String) -> Bool {
        switch validatePassword(password) {
        case .success: return true
        case .failure: return false
        }
    }

    /// Quick username validation check
    func isValidUsername(_ username: String) -> Bool {
        switch validateUsername(username) {
        case .success: return true
        case .failure: return false
        }
    }
}
