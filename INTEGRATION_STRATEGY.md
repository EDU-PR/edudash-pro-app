# EduDash Pro & EduSitePro Integration Strategy

## Current Decision: Keep Separate (Solo Developer Approach)

### Why Separate for Now
1. **Custom Domains**: Tenants need their own custom domains (e.g., `montessori-academy.co.za`), not subdomains like `sites.edudashpro.org.za`
2. **Complexity**: Full integration requires significant DevOps effort
3. **Solo Developer**: Limited bandwidth for maintenance
4. **Different Purposes**: 
   - EduDash Pro = Mobile app for parents/teachers (React Native)
   - EduSitePro = Public-facing websites for schools (Next.js)

### Current Architecture
- **EduDash Pro**: Separate Supabase instance, mobile-first
- **EduSitePro**: Separate Supabase instance, web-first with custom domains
- **Future**: Consider API bridge when scaling requires it

### Deferred Integration Tasks
- SSO between platforms
- Unified database
- Cross-platform analytics
- Bundle pricing

---

*Note: Revisit this when team grows or customer demand justifies the complexity.*
