import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data (in development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Clearing existing data...');
    await prisma.notification.deleteMany();
    await prisma.attendanceConfirmation.deleteMany();
    await prisma.timetable.deleteMany();
    await prisma.venue.deleteMany();
    await prisma.user.deleteMany();
  }

  // Seed venues
  console.log('🏢 Seeding venues...');
  const venues = await prisma.venue.createMany({
    data: [
      {
        name: 'Main Auditorium',
        location: 'Academic Block A - Ground Floor',
        capacity: 300,
        facilities: 'Projector, Audio System, Air Conditioning, WiFi',
      },
      {
        name: 'Computer Lab 1',
        location: 'IT Block - 1st Floor',
        capacity: 40,
        facilities: 'Computers, Projector, Air Conditioning, WiFi',
      },
      {
        name: 'Computer Lab 2',
        location: 'IT Block - 2nd Floor',
        capacity: 40,
        facilities: 'Computers, Projector, Air Conditioning, WiFi',
      },
      {
        name: 'Lecture Hall 101',
        location: 'Academic Block B - 1st Floor',
        capacity: 100,
        facilities: 'Projector, Whiteboard, Air Conditioning, WiFi',
      },
      {
        name: 'Lecture Hall 102',
        location: 'Academic Block B - 1st Floor',
        capacity: 100,
        facilities: 'Projector, Whiteboard, Air Conditioning, WiFi',
      },
      {
        name: 'Seminar Room 1',
        location: 'Academic Block C - Ground Floor',
        capacity: 30,
        facilities: 'TV Screen, Whiteboard, Air Conditioning, WiFi',
      },
    ],
  });

  // Seed users
  console.log('👥 Seeding users...');
  const users = await prisma.user.createMany({
    data: [
      {
        userId: 'REP001',
        email: 'john.smith@student.edutime.edu',
        fullName: 'John Smith',
        role: 'class_rep',
        phoneNumber: '+1234567890',
      },
      {
        userId: 'LEC001',
        email: 'dr.wilson@edutime.edu',
        fullName: 'Dr. Emily Wilson',
        role: 'lecturer',
        phoneNumber: '+1234567893',
      },
      {
        userId: 'LEC002',
        email: 'prof.brown@edutime.edu',
        fullName: 'Prof. Robert Brown',
        role: 'lecturer',
        phoneNumber: '+1234567894',
      },
      {
        userId: 'ADMIN001',
        email: 'admin@edutime.edu',
        fullName: 'System Administrator',
        role: 'admin',
        phoneNumber: '+1234567897',
      },
    ],
  });

  // Get venue IDs for timetable seeding
  const venueList = await prisma.venue.findMany();
  const computerLab1 = venueList.find(v => v.name === 'Computer Lab 1');
  const lectureHall101 = venueList.find(v => v.name === 'Lecture Hall 101');

  // Seed timetables
  console.log('📅 Seeding timetables...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dayAfterTomorrow = new Date();
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  const timetables = await prisma.timetable.createMany({
    data: [
      {
        subject: 'Computer Science 101',
        lecturer: 'Dr. Emily Wilson',
        classRep: 'John Smith',
        date: tomorrow,
        startTime: new Date('1970-01-01T09:00:00Z'),
        endTime: new Date('1970-01-01T10:30:00Z'),
        venueId: computerLab1?.id || 1,
        notes: 'Introduction to Programming',
      },
      {
        subject: 'Mathematics 201',
        lecturer: 'Prof. Robert Brown',
        classRep: 'John Smith',
        date: tomorrow,
        startTime: new Date('1970-01-01T11:00:00Z'),
        endTime: new Date('1970-01-01T12:30:00Z'),
        venueId: lectureHall101?.id || 2,
        notes: 'Calculus II',
      },
    ],
  });

  console.log('✅ Database seeded successfully!');
  console.log(`📊 Created:`);
  console.log(`   - ${venues.count} venues`);
  console.log(`   - ${users.count} users`);
  console.log(`   - ${timetables.count} timetables`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });