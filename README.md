# Competition Hub

Create an web page interface for external competition module
Should have a login page (Admin, Coordinator, Teacher)
Function of Admin
Admin should have a password admin123 has master control over everything. 
Creates user for coordinator and In-charge teacher – after which the user can change their own password
Database should have students list class/section wise (from class 1 to 12) 
student database should have S No. Admission No., Name, DOB, Class, Sec 
every year admin should be able to upload student list class wise.

Function of coordinator
Creates competition should have competition name, competition date, venue
Each competition should have various events (max 10) and each event should be assigned a category and each category should be assigned a class

Function of teacher
Should be able to see the competition assigned to their class
teacher has to select students from the list of class for the competition.

Reports
coordinator should be able to see the list of students who are participating in each competition, event.
Once the competition is over – coordinator should be able to update the prices received, (participation, First, Second, Runner up 1, Runner up 2, third, consolation, champion, other ) against the student, event, competition. 
Coordinator / admin should be able to see the list of all the student who have received the prizes, sorted in the order of (max prize first)

Coordinator should be able to take bona-fide certificate for the event with the list of students and the template (which can be uploaded by the coordinator) for each competition 

The data should be stored in google drive (path is specified by the admin)

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://school-competition.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2012207d-14a1-4575-8fd5-de953b579123).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
