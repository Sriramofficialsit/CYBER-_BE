// Synthetic / test data ONLY. All names, numbers, accounts and UPI IDs below
// are fictional and generated for this internal demo.
//
// Designed to exercise BOTH detection paths:
//   * shared-identifier links  — 0001/0002 (phone), 0001/0007 (account),
//                                0001/0010 (IFSC), 0003/0010 (phone),
//                                0008/0009 (email)
//   * semantic-only links      — 0003/0004 (stock-tips group), 0005/0006
//                                (video-call sextortion) share no identifier

export const seedCases = [
  {
    title: 'Fake electricity disconnection SMS — UPI payment',
    complainantName: 'Ramesh Iyer',
    complainantContact: '9123456780',
    fraudType: 'UPI fraud',
    assignedOfficer: 'SI Kavita Rao',
    narrative:
      'Complainant received an SMS on 12 Aug claiming his electricity connection would be disconnected tonight unless he cleared dues immediately. He called back the number 9876543210 and was told to pay Rs 11 through a link to "verify" his meter. The link opened an app that asked for card details. Shortly after, Rs 47,000 was debited in three transactions to the UPI ID quickpay.verify@okhdfcbank and onward to account number 123456789012 held at IFSC HDFC0001234. The caller spoke in Hindi and sounded scripted.',
  },
  {
    title: 'Power bill scam call — remote access app installed',
    complainantName: 'Sunita Deshpande',
    complainantContact: '9988770011',
    fraudType: 'phishing',
    assignedOfficer: 'SI Kavita Rao',
    narrative:
      'The complainant got a call from 9876543210 warning that her electricity would be cut within an hour due to a pending bill. She was guided to install a screen-sharing application and enter her banking password to "register" the payment of Rs 10. Rs 62,500 was then transferred out without OTP prompts she could see. The victim recalls the man used the same phrasing about a "verification charge" and pressured her to stay on the line.',
  },
  {
    title: 'Telegram crypto trading group — deposits never returned',
    complainantName: 'Arjun Menon',
    complainantContact: '9090901234',
    fraudType: 'investment scam',
    assignedOfficer: 'PI Rohit Sharma',
    narrative:
      'Complainant was added to a Telegram group promising 8% daily returns on a crypto arbitrage bot. An "account manager" reachable at 9811122233 asked him to deposit funds to account 555000111222 to activate a premium tier. The dashboard showed growing profits but withdrawals were blocked pending a 20% "tax" payment. Total loss Rs 3.1 lakh over two weeks. The group had fake testimonials and screenshots of large payouts.',
  },
  {
    title: 'WhatsApp stock tips group — pump and dump losses',
    complainantName: 'Farhan Qureshi',
    complainantContact: '9765432198',
    fraudType: 'investment scam',
    assignedOfficer: 'PI Rohit Sharma',
    narrative:
      'The complainant was added to a WhatsApp group promising guaranteed daily returns on "block deals" in small-cap shares, run by a supposed institutional analyst. An account manager asked him to deposit funds into an app to activate a premium tier. The dashboard showed growing profits but withdrawals were blocked pending an upfront margin and a "tax" payment. The group had fake testimonials and screenshots of large payouts. Members were told to buy specific shares at a set time; prices spiked then crashed. Total loss about Rs 2.4 lakh over two weeks. Admins removed him once he asked questions.',
  },
  {
    title: 'Video call blackmail after Facebook contact',
    complainantName: 'Deepak Nair',
    complainantContact: '9345678120',
    fraudType: 'sextortion',
    assignedOfficer: 'SI Meena Joshi',
    narrative:
      'A woman added the complainant on Facebook and moved the chat to a video call late at night. The call was recorded without his knowledge and he was shown a clip of himself, then threatened that it would be sent to his contact list unless he paid. The extortionist called from 9700000001 and demanded Rs 25,000 via a payment link, later increasing the amount. The complainant paid once before reporting.',
  },
  {
    title: 'Instagram friend request leads to recorded video call extortion',
    complainantName: 'Vikram Bhosale',
    complainantContact: '9812345670',
    fraudType: 'sextortion',
    assignedOfficer: 'SI Meena Joshi',
    narrative:
      'An unknown woman added the complainant on Instagram and moved the chat to a video call late at night. The call was recorded without his knowledge and he was coaxed into a compromising position. He was then threatened that the clip would be sent to his contact list unless he paid. Messages followed impersonating a police officer and a "YouTube copyright team" demanding money to take down the video, with the amount increasing each time. Payment was requested through gift codes and a UPI collect request. He did not pay and blocked the accounts.',
  },
  {
    title: 'KYC update fraud — account suspended threat',
    complainantName: 'Lakshmi Prasad',
    complainantContact: '9871230000',
    fraudType: 'UPI fraud',
    assignedOfficer: 'SI Kavita Rao',
    narrative:
      'Complainant received a message that her bank account would be suspended unless KYC was updated the same day. She clicked the link and entered her account and card information. A caller then walked her through approving a request on her banking app. Rs 89,000 moved to account number 123456789012 in two transfers. The complainant says the caller already knew the last four digits of her debit card.',
  },
  {
    title: 'Bank OTP vishing call impersonating branch manager',
    complainantName: 'Imran Shaikh',
    complainantContact: '9900112233',
    fraudType: 'phishing',
    assignedOfficer: 'PI Rohit Sharma',
    narrative:
      'A caller claiming to be the branch manager told the complainant his debit card was blocked and asked him to confirm an OTP to reactivate it. The complainant shared two OTPs. Rs 34,000 was spent on online purchases. Follow-up emails came from support.rewards@example.com asking him to "confirm the reversal" by sharing more details. The email signature used the bank logo.',
  },
  {
    title: 'Work-from-home task scam — recruiter email',
    complainantName: 'Neha Kulkarni',
    complainantContact: '9821001100',
    fraudType: 'other',
    assignedOfficer: 'SI Meena Joshi',
    narrative:
      'The complainant applied for a part-time online job after an email from support.rewards@example.com offering Rs 5,000 per day for rating hotels. Small payouts came first to build trust, then she was asked to deposit her own money to unlock "merged tasks" and recover a negative balance. She paid Rs 1.7 lakh across several UPI transfers before realising the withdrawal button never worked.',
  },
  {
    title: 'Crypto doubling scheme — celebrity endorsement deepfake',
    complainantName: 'Sanjay Pawar',
    complainantContact: '9700055500',
    fraudType: 'investment scam',
    assignedOfficer: 'PI Rohit Sharma',
    narrative:
      'Complainant saw a video of a well-known businessman promoting a platform that "doubles" any crypto sent to it within 24 hours. He contacted support at 9811122233 and was told to transfer funds and pay processing to account maintained at IFSC HDFC0001234. After the first transfer he was asked for a larger "unlock" fee. Loss of Rs 4.6 lakh. The endorsement video was later confirmed to be AI-generated.',
  },
];
