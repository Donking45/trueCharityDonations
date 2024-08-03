import {
    assert,
    ByteString,
    hash256,
    method,
    prop,
    SmartContract,
    FixedArray,
    fill,
    toByteString,
    slice,
} from 'scrypt-ts'

export type Name = string

export type Charity = {
    charity_Id: ByteString
    amountReceived: bigint
    amountSpent: bigint
}

export type ExpenditureProof = {
    expenditure_Amount: bigint
    proof: ByteString
    total_Expenditure: bigint
}

export type Donation = {
    amount: bigint
    charity_id: ByteString
}

export const N = 100

export type Charities = FixedArray<Charity, typeof N>
export type Donations = FixedArray<Donation, typeof N>
export type ExpenditureProofs = FixedArray<ExpenditureProof, typeof N>
export type Names = FixedArray<ByteString, typeof N>

export class Donate extends SmartContract {
    @prop()
    charities: Charities

    @prop()
    donations: Donations

    @prop(true)
    expenditureProofs: ExpenditureProofs

    @prop()
    names: Names

    constructor(names: Names) {
        super(...arguments)

        // Initialize fixed array
        this.charities = fill(
            {
                charity_Id: toByteString(''),
                amountReceived: 0n,
                amountSpent: 0n,
            },
            N
        )

        this.donations = fill({ amount: 0n, charity_id: toByteString('') }, N)

        this.expenditureProofs = fill(
            {
                expenditure_Amount: 0n,
                proof: toByteString(''),
                total_Expenditure: 0n,
            },
            N
        )

        this.names = names

        // Initialize charities with provided charityIds
        for (let i = 0; i < N; i++) {
            const charityId = slice(this.names[i], 0n, 32n) // Adjust the slice parameters as needed
            this.charities[i] = {
                charity_Id: charityId,
                amountReceived: 0n,
                amountSpent: 0n,
            }
        }
    }

    @method()
    public addDonation(charity_id: ByteString, amount: bigint) {
        let charityFound = false

        for (let i = 0; i < N; i++) {
            if (this.charities[i].charity_Id === charity_id) {
                this.donations[i] = { charity_id, amount } // Update donation amount
                this.charities[i].amountReceived += amount
                charityFound = true
            }
        }

        assert(charityFound, 'Charity not found')

        // Build output and assert state consistency
        const outputs: ByteString = this.buildStateOutput(this.ctx.utxo.value)
        assert(
            this.ctx.hashOutputs === hash256(outputs),
            'hashOutputs mismatch'
        )
    }

    @method()
    public addExpenditureProof(
        charityId: ByteString,
        expenditure_Amount: bigint,
        proof: ByteString
    ) {
        let charityFound = false

        for (let i = 0; i < N; i++) {
            if (this.charities[i].charity_Id === charityId) {
                this.expenditureProofs[i] = {
                    expenditure_Amount,
                    proof,
                    total_Expenditure: this.charities[i].amountSpent,
                }
                charityFound = true
            }
        }

        assert(charityFound, 'Charity not found')

        // Build output and assert state consistency
        const outputs: ByteString = this.buildStateOutput(this.ctx.utxo.value)
        assert(
            this.ctx.hashOutputs === hash256(outputs),
            'hashOutputs mismatch'
        )
    }

    @method()
    public matchDonationWithExpenditureProof(
        donationIndex: number,
        expenditureProofIndex: number
    ) {
        assert(
            donationIndex >= 0 && donationIndex < N,
            'Invalid donation index'
        )
        assert(
            expenditureProofIndex >= 0 && expenditureProofIndex < N,
            'Invalid expenditure proof index'
        )

        const donation = this.donations[donationIndex]
        const expenditureProof = this.expenditureProofs[expenditureProofIndex]
        let charityFound = false

        for (let i = 0; i < N; i++) {
            if (this.charities[i].charity_Id === donation.charity_id) {
                const charity = this.charities[i]
                if (donation.amount === expenditureProof.expenditure_Amount) {
                    charity.amountSpent += donation.amount
                    charityFound = true
                }
            }
        }

        assert(
            charityFound,
            'Charity not found or donation does not match expenditure proof'
        )

        // Build output and assert state consistency
        const outputs: ByteString = this.buildStateOutput(this.ctx.utxo.value)
        assert(
            this.ctx.hashOutputs === hash256(outputs),
            'hashOutputs mismatch'
        )
    }
}
