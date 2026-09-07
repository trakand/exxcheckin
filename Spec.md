* this is an app for check in at an event.
* app needs to be very have a very responsive UI
* this is to be hosted in github pages
* app to be accessed by scanning a QR code.
* checkin view
  * fields
   * Name - Autocomplete box. Suggestions to be pulled from a google sheet having anonymous access, free text allowed. Required field
   * Batch - Autocomplete box. Suggestions to be pulled from a google sheet having anonymous access, free text allowed. Required field.
   * Timestamp - read only field. current date and time.
   * 'Check-In' button.
    * submits the data from the other fields
    * data should be saved to the same google sheet. In the 'CheckIn Log' sheet.
    * once data is saved, the user is navigated to a checkin completed page.
* Google spread sheet link : https://docs.google.com/spreadsheets/d/1IIzqDQ4_tBPvvjX6zYBLXiKZliJs36wC7x8SvoeNo2s/edit?usp=sharing
* checkin completed view
  * Shows details user entered in Check view. read only.
  * Shows text "Lets party"
* Once checked in, the app remembers that the user has checked in and show the checkin completed view. Does not take to the checkin view. (how to remember ? cookie ? local storage ?)
* Feedback view
  * to be accessed via a different qr code
  * user will scan this at the end of the event.
  * shows the users name and batch which was submitted at checkin time.
  * text area field to enter the feedback.
  * button to submit the feedback.
  * submitted feedback to go into the 'feedback column' of the 'CheckIn Log' sheet.

* Theme TBD.
