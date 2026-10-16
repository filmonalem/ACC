import { Module } from '@nestjs/common';
import { AdminContactsController, ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  controllers: [ContactsController, AdminContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
