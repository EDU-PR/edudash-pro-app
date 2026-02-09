import { useState, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';

interface UseDirectAddTeacherOptions {
  getPreschoolId: () => string | null | undefined;
  userId: string | undefined;
  schoolName: string;
  fetchTeachers: () => Promise<void>;
  loadInvites: () => Promise<void>;
  showAlert: (opts: any) => void;
  handleShareInvite: (token: string, email: string) => Promise<void>;
}

export function useDirectAddTeacher(opts: UseDirectAddTeacherOptions) {
  const {
    getPreschoolId, userId, schoolName,
    fetchTeachers, loadInvites, showAlert, handleShareInvite,
  } = opts;

  const [showDirectAddModal, setShowDirectAddModal] = useState(false);
  const [directTeacherName, setDirectTeacherName] = useState('');
  const [directTeacherEmail, setDirectTeacherEmail] = useState('');
  const [directTeacherPhone, setDirectTeacherPhone] = useState('');

  const resetDirectAddForm = useCallback(() => {
    setDirectTeacherName('');
    setDirectTeacherEmail('');
    setDirectTeacherPhone('');
  }, []);

  const handleDirectAddTeacher = useCallback(async () => {
    const name = directTeacherName.trim();
    const email = directTeacherEmail.trim().toLowerCase();
    const phone = directTeacherPhone.trim();

    if (!name) {
      showAlert({ title: 'Name Required', message: "Please enter the teacher's name.", type: 'warning' });
      return;
    }
    const preschoolId = getPreschoolId();
    if (!preschoolId) {
      showAlert({ title: 'Error', message: 'No school associated with your account.', type: 'error' });
      return;
    }

    try {
      const supabase = assertSupabase();

      // Check if teacher already exists at this school
      if (email) {
        const { data: existingTeachers } = await supabase
          .from('teachers')
          .select('id, user_id, email, first_name, last_name')
          .eq('preschool_id', preschoolId)
          .ilike('email', email);

        if (existingTeachers && existingTeachers.length > 0) {
          const t = existingTeachers[0] as any;
          const tName = t.first_name
            ? `${t.first_name} ${t.last_name || ''}`.trim()
            : email;
          showAlert({ title: 'Already Added', message: `${tName} is already a teacher at your school.`, type: 'info' });
          return;
        }
      }

      // Check if a user profile exists with this email
      let profileId: string | null = null;
      if (email) {
        const { data: existingProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, phone')
          .ilike('email', email);

        if (existingProfiles && existingProfiles.length > 0) {
          profileId = existingProfiles[0].id;
          const { data: existingMembership } = await supabase
            .from('teachers')
            .select('id')
            .eq('preschool_id', preschoolId)
            .eq('user_id', profileId);

          if (existingMembership && existingMembership.length > 0) {
            showAlert({ title: 'Already a Member', message: 'This person is already linked to your school.', type: 'info' });
            return;
          }
        }
      }

      // Insert teacher record
      const nameParts = name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      const { error: insertError } = await supabase
        .from('teachers')
        .insert({
          preschool_id: preschoolId,
          user_id: profileId,
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          email: email || null,
          phone: phone || null,
          role: 'teacher',
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Link profile to org if exists
      if (profileId) {
        const { error: membershipError } = await supabase
          .from('organization_members')
          .upsert({
            user_id: profileId,
            organization_id: preschoolId,
            role: 'teacher',
            status: 'active',
          });
        if (membershipError) console.warn('Membership error:', membershipError);
      }

      setShowDirectAddModal(false);
      resetDirectAddForm();
      await fetchTeachers();

      showAlert({
        title: 'Teacher Added',
        message: `${name} has been added to your school.${!profileId ? " They'll need to create an EduDash Pro account to access the platform." : ''}`,
        type: 'success',
        buttons: profileId ? undefined : [
          { text: 'OK' },
          {
            text: 'Send Invite',
            onPress: async () => {
              if (email) {
                try {
                  const { TeacherInviteService } = await import('@/lib/services/teacherInviteService');
                  const invite = await TeacherInviteService.createInvite({
                    schoolId: preschoolId,
                    email,
                    invitedBy: userId || '',
                  });
                  await loadInvites();
                  await handleShareInvite(invite.token, email);
                } catch {
                  showAlert({ title: 'Invite Failed', message: 'Teacher added but invite could not be sent.', type: 'warning' });
                }
              }
            },
          },
        ],
      });
    } catch (err: unknown) {
      showAlert({ title: 'Error', message: err instanceof Error ? err.message : 'Failed to add teacher', type: 'error' });
    }
  }, [directTeacherName, directTeacherEmail, directTeacherPhone, getPreschoolId, userId, fetchTeachers, loadInvites, showAlert, handleShareInvite, resetDirectAddForm]);

  return {
    showDirectAddModal, setShowDirectAddModal,
    directTeacherName, setDirectTeacherName,
    directTeacherEmail, setDirectTeacherEmail,
    directTeacherPhone, setDirectTeacherPhone,
    resetDirectAddForm, handleDirectAddTeacher,
  };
}
